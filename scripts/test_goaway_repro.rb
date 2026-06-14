#!/usr/bin/env ruby
# frozen_string_literal: true

#
# Minimal reproduction: HTTP/2 GOAWAY on idle persistent connection with httpx
#
# This script creates an HTTP/2 TLS server that sends GOAWAY after a short idle
# period, then uses httpx with the persistent plugin to demonstrate the behavior
# when reusing a stale connection.
#
# Usage: ruby scripts/test_goaway_repro.rb
#

require "socket"
require "openssl"
require "http/2"
require "httpx"
require "timeout"

GOAWAY_IDLE_TIMEOUT = 3 # seconds before server sends GOAWAY
SERVER_PORT = 19443
VERBOSE = ENV["VERBOSE"] == "1"

# ─── Self-signed TLS certificate ───────────────────────────────────────────────

def generate_self_signed_cert
  key = OpenSSL::PKey::RSA.new(2048)
  cert = OpenSSL::X509::Certificate.new
  cert.version = 2
  cert.serial = 1
  cert.subject = OpenSSL::X509::Name.parse("/CN=localhost")
  cert.issuer = cert.subject
  cert.public_key = key.public_key
  cert.not_before = Time.now
  cert.not_after = Time.now + 3600

  ef = OpenSSL::X509::ExtensionFactory.new
  ef.subject_certificate = cert
  ef.issuer_certificate = cert
  cert.add_extension(ef.create_extension("subjectAltName", "DNS:localhost,IP:127.0.0.1"))

  cert.sign(key, OpenSSL::Digest.new("SHA256"))
  [key, cert]
end

# ─── HTTP/2 TLS Server ─────────────────────────────────────────────────────────

def start_server(key, cert)
  tcp_server = TCPServer.new("127.0.0.1", SERVER_PORT)

  ssl_ctx = OpenSSL::SSL::SSLContext.new
  ssl_ctx.key = key
  ssl_ctx.cert = cert
  ssl_ctx.alpn_protocols = ["h2"]
  ssl_ctx.alpn_select_cb = ->(_) { "h2" }

  ssl_server = OpenSSL::SSL::SSLServer.new(tcp_server, ssl_ctx)
  ssl_server.start_immediately = true

  Thread.new do
    loop do
      begin
        ssl_socket = ssl_server.accept
        handle_h2_connection(ssl_socket)
      rescue => e
        $stderr.puts "[SERVER] Accept error: #{e.class}: #{e.message}" if VERBOSE
      end
    end
  end

  tcp_server
end

def handle_h2_connection(ssl_socket)
  Thread.new(ssl_socket) do |sock|
    conn = HTTP2::Server.new

    last_activity = Time.now
    goaway_sent = false
    request_count = 0

    conn.on(:frame) do |bytes|
      sock.write(bytes)
      sock.flush
    rescue IOError, Errno::EPIPE => e
      $stderr.puts "[SERVER] Write error: #{e.class}: #{e.message}" if VERBOSE
    end

    conn.on(:stream) do |stream|
      request_headers = {}

      bidi_mode = false
      headers_sent_for_stream = false
      data_chunk_count = 0

      stream.on(:data) do |data|
        last_activity = Time.now
        $stderr.puts "[SERVER] Received data: #{data.bytesize} bytes" if VERBOSE

        if bidi_mode
          data_chunk_count += 1
          # Echo back a response for each received data chunk
          response_chunk = "{\"echo\":#{data_chunk_count}}\n"
          stream.data(response_chunk, end_stream: false)
          $stderr.puts "[SERVER] Echoed bidi chunk ##{data_chunk_count}" if VERBOSE
        end
      end

      stream.on(:half_close) do
        last_activity = Time.now

        path = request_headers[":path"]
        body = nil

        case path
        when "/test"
          body = "OK from request ##{request_count}"
        when "/stream"
          if bidi_mode
            # Bidi mode: client closed their end, send final chunk and close
            stream.data("{\"done\":true}\n", end_stream: true)
            $stderr.puts "[SERVER] Bidi stream completed" if VERBOSE
            next
          end
          # Non-bidi stream mode: send response headers + chunked data
          stream.headers({
            ":status" => "200",
            "content-type" => "text/plain",
          })
          3.times do |i|
            sleep 0.3
            chunk = "chunk-#{i}\n"
            stream.data(chunk, end_stream: i == 2)
            $stderr.puts "[SERVER] Sent chunk #{i}" if VERBOSE
          end
          next
        else
          body = "Not Found"
        end

        stream.headers({
          ":status" => body == "Not Found" ? "404" : "200",
          "content-type" => "text/plain",
          "content-length" => body.bytesize.to_s,
        })
        stream.data(body)
      end

      stream.on(:headers) do |headers|
        request_headers = headers.to_h
        last_activity = Time.now
        request_count += 1
        $stderr.puts "[SERVER] Request ##{request_count}: #{request_headers[':method']} #{request_headers[':path']}" if VERBOSE

        # Detect bidi streaming requests (POST to /stream with ndjson)
        if request_headers[":path"] == "/stream" &&
           request_headers[":method"] == "POST" &&
           request_headers["content-type"]&.include?("ndjson")
          bidi_mode = true
          headers_sent_for_stream = false
          data_chunk_count = 0
          # Send response headers immediately for bidi
          stream.headers({
            ":status" => "200",
            "content-type" => "application/x-ndjson",
          })
          headers_sent_for_stream = true
          $stderr.puts "[SERVER] Bidi mode activated" if VERBOSE
        end
      end
    end

    # Read initial connection preface and process frames
    # Also run an idle checker in a separate thread
    goaway_thread = Thread.new do
      loop do
        sleep 0.5
        next if goaway_sent

        idle_time = Time.now - last_activity
        if idle_time >= GOAWAY_IDLE_TIMEOUT
          $stderr.puts "[SERVER] Idle for #{idle_time.round(1)}s, sending GOAWAY (no_error)" if VERBOSE
          begin
            conn.goaway(:no_error)
          rescue => e
            $stderr.puts "[SERVER] GOAWAY send error: #{e.class}: #{e.message}" if VERBOSE
          end
          goaway_sent = true
          # Keep the TCP connection alive for a bit so the client encounters
          # the GOAWAY frame (not just EOF)
          sleep 5
          $stderr.puts "[SERVER] Closing TCP connection after GOAWAY grace period" if VERBOSE
          sock.close rescue nil
          break
        end
      end
    end

    # Main read loop
    loop do
      data = sock.read_nonblock(16384)
      conn << data
      last_activity = Time.now unless goaway_sent
    rescue IO::WaitReadable
      IO.select([sock], nil, nil, 0.5)
      retry
    rescue EOFError, IOError, Errno::ECONNRESET, OpenSSL::SSL::SSLError => e
      $stderr.puts "[SERVER] Connection closed: #{e.class}: #{e.message}" if VERBOSE
      break
    end

    goaway_thread.kill
    sock.close rescue nil
  end
end

# ─── Test Cases ─────────────────────────────────────────────────────────────────

def test_non_streaming
  puts "\n#{'=' * 70}"
  puts "TEST 1: Non-streaming request after GOAWAY (persistent connection)"
  puts "#{'=' * 70}"

  session = HTTPX.plugin(:persistent)
    .with(
      ssl: { verify_mode: OpenSSL::SSL::VERIFY_NONE },
      timeout: { connect_timeout: 5, operation_timeout: 10 },
    )

  # First request — establishes connection
  puts "\n[CLIENT] Sending first request..."
  response1 = session.get("https://127.0.0.1:#{SERVER_PORT}/test")
  puts "[CLIENT] Response 1: status=#{response1.status} body=#{response1.body.to_s.inspect}"
  raise "First request failed: #{response1.status}" unless response1.status == 200

  # Wait for server to send GOAWAY
  wait_time = GOAWAY_IDLE_TIMEOUT + 2
  puts "\n[CLIENT] Waiting #{wait_time}s for server GOAWAY..."
  sleep wait_time

  # Second request — reuses stale connection
  puts "\n[CLIENT] Sending second request (should retry on new connection)..."
  begin
    response2 = Timeout.timeout(15) do
      session.get("https://127.0.0.1:#{SERVER_PORT}/test")
    end
    puts "[CLIENT] Response 2: status=#{response2.status} body=#{response2.body.to_s.inspect}"

    if response2.status == 200
      puts "\n[RESULT] PASS — httpx properly retried after GOAWAY"
    else
      puts "\n[RESULT] FAIL — got unexpected status: #{response2.status}"
    end
  rescue Timeout::Error
    puts "\n[RESULT] FAIL — HUNG! Request timed out after 15 seconds"
    puts "         This demonstrates the stale connection bug."
  rescue => e
    puts "\n[RESULT] FAIL — Exception: #{e.class}: #{e.message}"
  ensure
    session.close
  end
end

def test_streaming
  puts "\n#{'=' * 70}"
  puts "TEST 2: Streaming request after GOAWAY (persistent connection)"
  puts "#{'=' * 70}"

  session = HTTPX.plugin(:persistent).plugin(:stream)
    .with(
      ssl: { verify_mode: OpenSSL::SSL::VERIFY_NONE },
      timeout: { connect_timeout: 5, operation_timeout: 10 },
    )

  # First request — establishes connection (non-streaming)
  puts "\n[CLIENT] Sending first request (non-streaming, to establish connection)..."
  response1 = session.get("https://127.0.0.1:#{SERVER_PORT}/test")
  puts "[CLIENT] Response 1: status=#{response1.status} body=#{response1.body.to_s.inspect}"
  raise "First request failed: #{response1.status}" unless response1.status == 200

  # Wait for server to send GOAWAY
  wait_time = GOAWAY_IDLE_TIMEOUT + 2
  puts "\n[CLIENT] Waiting #{wait_time}s for server GOAWAY..."
  sleep wait_time

  # Second request — streaming, on stale connection
  puts "\n[CLIENT] Sending streaming request (should retry on new connection)..."
  begin
    chunks = []
    Timeout.timeout(15) do
      response2 = session.get("https://127.0.0.1:#{SERVER_PORT}/stream", stream: true)
      response2.each do |chunk|
        chunks << chunk
        puts "[CLIENT] Received stream chunk: #{chunk.inspect}"
      end
    end
    puts "[CLIENT] Total chunks received: #{chunks.size}"

    if chunks.size == 3
      puts "\n[RESULT] PASS — streaming request properly retried after GOAWAY"
    else
      puts "\n[RESULT] UNEXPECTED — got #{chunks.size} chunks instead of 3"
    end
  rescue Timeout::Error
    puts "\n[RESULT] FAIL — HUNG! Streaming request timed out after 15 seconds"
    puts "         This demonstrates the stale connection bug with streaming."
  rescue => e
    puts "\n[RESULT] FAIL — Exception: #{e.class}: #{e.message}"
    puts "         #{e.backtrace.first(5).join("\n         ")}"
  ensure
    session.close
  end
end

def test_streaming_post
  puts "\n#{'=' * 70}"
  puts "TEST 3: Streaming POST after GOAWAY (mimics react_on_rails_pro)"
  puts "#{'=' * 70}"

  session = HTTPX.plugin(:persistent).plugin(:stream)
    .with(
      ssl: { verify_mode: OpenSSL::SSL::VERIFY_NONE },
      timeout: { connect_timeout: 5, operation_timeout: 10 },
    )

  # First request — establishes connection
  puts "\n[CLIENT] Sending first request (to establish connection)..."
  response1 = session.get("https://127.0.0.1:#{SERVER_PORT}/test")
  puts "[CLIENT] Response 1: status=#{response1.status} body=#{response1.body.to_s.inspect}"
  raise "First request failed: #{response1.status}" unless response1.status == 200

  # Wait for server to send GOAWAY
  wait_time = GOAWAY_IDLE_TIMEOUT + 2
  puts "\n[CLIENT] Waiting #{wait_time}s for server GOAWAY..."
  sleep wait_time

  # Streaming POST — like react_on_rails_pro's server rendering request
  puts "\n[CLIENT] Sending streaming POST (should retry on new connection)..."
  begin
    chunks = []
    Timeout.timeout(15) do
      response2 = session.post(
        "https://127.0.0.1:#{SERVER_PORT}/stream",
        stream: true,
        body: '{"component":"BlogPost"}',
        headers: { "content-type" => "application/json" },
      )
      response2.each do |chunk|
        chunks << chunk
        puts "[CLIENT] Received stream chunk: #{chunk.inspect}"
      end
    end
    puts "[CLIENT] Total chunks received: #{chunks.size}"

    if chunks.size == 3
      puts "\n[RESULT] PASS — streaming POST properly retried after GOAWAY"
    else
      puts "\n[RESULT] UNEXPECTED — got #{chunks.size} chunks instead of 3"
    end
  rescue Timeout::Error
    puts "\n[RESULT] FAIL — HUNG! Streaming POST timed out after 15 seconds"
    puts "         This is the exact bug from react_on_rails_pro."
  rescue => e
    puts "\n[RESULT] FAIL — Exception: #{e.class}: #{e.message}"
    puts "         #{e.backtrace.first(5).join("\n         ")}"
  ensure
    session.close
  end
end

def test_no_ping_probe
  puts "\n#{'=' * 70}"
  puts "TEST 4: No PING probe (keep_alive_timeout > idle timeout)"
  puts "  Tests: request sent directly without liveness check"
  puts "#{'=' * 70}"

  # Set keep_alive_timeout very high so httpx skips the PING probe and sends
  # the request directly on the stale connection.
  session = HTTPX.plugin(:persistent)
    .with(
      ssl: { verify_mode: OpenSSL::SSL::VERIFY_NONE },
      timeout: { connect_timeout: 5, operation_timeout: 10, keep_alive_timeout: 600 },
    )

  puts "\n[CLIENT] Sending first request..."
  response1 = session.get("https://127.0.0.1:#{SERVER_PORT}/test")
  puts "[CLIENT] Response 1: status=#{response1.status} body=#{response1.body.to_s.inspect}"
  raise "First request failed: #{response1.status}" unless response1.status == 200

  wait_time = GOAWAY_IDLE_TIMEOUT + 2
  puts "\n[CLIENT] Waiting #{wait_time}s for server GOAWAY..."
  puts "[CLIENT] (keep_alive_timeout=600s, so NO ping probe will be sent)"
  sleep wait_time

  puts "\n[CLIENT] Sending second request (no ping, direct send on stale conn)..."
  begin
    response2 = Timeout.timeout(15) do
      session.get("https://127.0.0.1:#{SERVER_PORT}/test")
    end
    puts "[CLIENT] Response 2: status=#{response2.status} body=#{response2.body.to_s.inspect}"

    if response2.status == 200
      puts "\n[RESULT] PASS — retried successfully even without PING probe"
    else
      puts "\n[RESULT] FAIL — unexpected status: #{response2.status}"
    end
  rescue Timeout::Error
    puts "\n[RESULT] FAIL — HUNG! Request timed out after 15 seconds"
    puts "         Bug: without PING probe, stale connection hangs."
  rescue => e
    puts "\n[RESULT] FAIL — Exception: #{e.class}: #{e.message}"
    puts "         #{e.backtrace.first(5).join("\n         ")}"
  ensure
    session.close
  end
end

def test_tcp_closed_before_reuse
  puts "\n#{'=' * 70}"
  puts "TEST 5: TCP closed by server before client reuses connection"
  puts "  Tests: server closes TCP right after GOAWAY (no grace period)"
  puts "#{'=' * 70}"

  session = HTTPX.plugin(:persistent)
    .with(
      ssl: { verify_mode: OpenSSL::SSL::VERIFY_NONE },
      timeout: { connect_timeout: 5, operation_timeout: 10 },
    )

  puts "\n[CLIENT] Sending first request..."
  response1 = session.get("https://127.0.0.1:#{SERVER_PORT}/test")
  puts "[CLIENT] Response 1: status=#{response1.status} body=#{response1.body.to_s.inspect}"
  raise "First request failed: #{response1.status}" unless response1.status == 200

  # Wait for GOAWAY + TCP close (server waits 5s after GOAWAY to close TCP)
  wait_time = GOAWAY_IDLE_TIMEOUT + 7
  puts "\n[CLIENT] Waiting #{wait_time}s (GOAWAY + TCP close)..."
  sleep wait_time

  puts "\n[CLIENT] Sending second request (TCP already closed by server)..."
  begin
    response2 = Timeout.timeout(15) do
      session.get("https://127.0.0.1:#{SERVER_PORT}/test")
    end
    puts "[CLIENT] Response 2: status=#{response2.status} body=#{response2.body.to_s.inspect}"

    if response2.status == 200
      puts "\n[RESULT] PASS — retried on new connection after TCP close"
    else
      puts "\n[RESULT] FAIL — unexpected status: #{response2.status}"
    end
  rescue Timeout::Error
    puts "\n[RESULT] FAIL — HUNG! Request timed out after 15 seconds"
    puts "         Bug: TCP-closed stale connection hangs."
  rescue => e
    puts "\n[RESULT] FAIL — Exception: #{e.class}: #{e.message}"
    puts "         #{e.backtrace.first(5).join("\n         ")}"
  ensure
    session.close
  end
end

def test_bidi_streaming
  puts "\n#{'=' * 70}"
  puts "TEST 6: Bidirectional streaming (stream_bidi) after GOAWAY"
  puts "  Tests: writer thread sends data while response is consumed"
  puts "  This is the exact react_on_rails_pro pattern."
  puts "#{'=' * 70}"

  session = HTTPX.plugin(:persistent).plugin(:stream_bidi)
    .plugin(:retries, retry_change_requests: true, max_retries: 2)
    .with(
      ssl: { verify_mode: OpenSSL::SSL::VERIFY_NONE },
      timeout: { connect_timeout: 5, operation_timeout: 15 },
    )

  # First request — establishes connection (non-streaming)
  puts "\n[CLIENT] Sending first request (to establish connection)..."
  response1 = session.get("https://127.0.0.1:#{SERVER_PORT}/test")
  puts "[CLIENT] Response 1: status=#{response1.status} body=#{response1.body.to_s.inspect}"
  raise "First request failed: #{response1.status}" unless response1.status == 200

  # Wait for server to send GOAWAY
  wait_time = GOAWAY_IDLE_TIMEOUT + 2
  puts "\n[CLIENT] Waiting #{wait_time}s for server GOAWAY..."
  sleep wait_time

  # Bidirectional streaming POST — matching react_on_rails_pro pattern
  puts "\n[CLIENT] Sending bidi streaming POST..."
  begin
    request = session.build_request(
      "POST",
      "https://127.0.0.1:#{SERVER_PORT}/stream",
      headers: { "content-type" => "application/x-ndjson" },
      body: ['{"init":"true"}'],
      stream: true,
    )

    response2 = session.request(request)

    chunks = []
    writer_error = nil

    # Writer thread — sends data from a separate thread (like async props emitter)
    writer = Thread.new do
      sleep 0.2 # let response start
      2.times do |i|
        request << "{\"data\":\"chunk_#{i}\"}\n"
        sleep 0.1
      end
      request.close
    rescue => e
      writer_error = e
    end

    Timeout.timeout(15) do
      response2.each do |chunk|
        chunks << chunk
        puts "[CLIENT] Received bidi chunk: #{chunk.inspect}"
      end
    end
    writer.join(5)

    puts "[CLIENT] Total chunks received: #{chunks.size}"

    if writer_error
      puts "\n[RESULT] FAIL — Writer thread error: #{writer_error.class}: #{writer_error.message}"
    elsif chunks.any?
      puts "\n[RESULT] PASS — bidi streaming POST retried after GOAWAY"
    else
      puts "\n[RESULT] FAIL — no chunks received"
    end
  rescue Timeout::Error
    puts "\n[RESULT] FAIL — HUNG! Bidi streaming timed out after 15 seconds"
    puts "         This is the react_on_rails_pro GOAWAY bug."
  rescue => e
    puts "\n[RESULT] FAIL — Exception: #{e.class}: #{e.message}"
    puts "         #{e.backtrace.first(5).join("\n         ")}"
  ensure
    session.close
  end
end

# ─── Main ───────────────────────────────────────────────────────────────────────

puts "HTTP/2 GOAWAY Stale Connection Reproduction"
puts "============================================"
puts "httpx version: #{HTTPX::VERSION}"
puts "http-2 version: #{HTTP2::VERSION}"
puts "Server GOAWAY idle timeout: #{GOAWAY_IDLE_TIMEOUT}s"
puts "Server port: #{SERVER_PORT}"

key, cert = generate_self_signed_cert
server = start_server(key, cert)

# Give server time to start
sleep 0.5

begin
  test_non_streaming
  sleep 1 # let previous connection fully close

  test_streaming
  sleep 1

  test_streaming_post
  sleep 1

  test_no_ping_probe
  sleep 1

  test_tcp_closed_before_reuse
  sleep 1

  test_bidi_streaming
rescue => e
  puts "\nFATAL: #{e.class}: #{e.message}"
  puts e.backtrace.first(10).join("\n")
ensure
  puts "\n\nCleaning up..."
  server.close rescue nil
  puts "Done."
end
