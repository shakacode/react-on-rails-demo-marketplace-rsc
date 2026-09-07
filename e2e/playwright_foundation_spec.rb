# frozen_string_literal: true

require 'open3'
require 'socket'
require 'stringio'
require_relative '../spec/rails_helper'
require_relative 'e2e_helper'

# rubocop:disable Metrics/BlockLength
RSpec.describe 'Rails-aware Playwright foundation' do
  let(:valid_token) { 'a' * 64 }

  it 'loads the Rails command bridge in the test environment' do
    expect(defined?(CypressOnRails)).to eq('constant')
  end

  it 'requires an explicit opt-in in the test environment' do
    expect(E2ERailsBridge.enabled?(environment: 'test', opt_in: nil, token: valid_token)).to be(false)
    expect(E2ERailsBridge.enabled?(environment: 'test', opt_in: '1', token: nil)).to be(false)
    expect(E2ERailsBridge.enabled?(environment: 'test', opt_in: '1', token: 'short')).to be(false)
    expect(E2ERailsBridge.enabled?(environment: 'test', opt_in: '1', token: valid_token)).to be(true)
    expect(E2ERailsBridge.enabled?(environment: 'development', opt_in: '1', token: valid_token)).to be(false)
    expect(E2ERailsBridge.enabled?(environment: 'production', opt_in: '1', token: valid_token)).to be(false)
    expect(Rails.root.join('e2e/README.md').read.split.join(' ')).to include(
      'available only when Rails runs in the test environment'
    )
    expect(CypressOnRails.configuration.use_middleware).to be(false)

    middleware_names = Rails.application.middleware.middlewares.map { |middleware| middleware.klass.name }
    expect(middleware_names).not_to include('CypressOnRails::Middleware')
    expect(middleware_names).not_to include('CypressOnRails::StateResetMiddleware')
  end

  it 'rejects non-loopback peers even when proxy headers claim loopback' do
    request = Rack::Request.new(
      'REMOTE_ADDR' => '192.0.2.10',
      'HTTP_X_FORWARDED_FOR' => '127.0.0.1',
      'REQUEST_METHOD' => 'POST',
      'rack.input' => StringIO.new({ name: 'clean' }.to_json)
    )

    expect(E2ERailsBridge.authorize(request, expected_token: valid_token)).to match(
      [403, include('content-type' => 'text/plain; charset=utf-8'), ['Forbidden']]
    )
  end

  it 'allows only the named cleanup and product-search scenario files' do
    clean_request = bridge_request({ name: 'clean' }, token: valid_token)
    scenario_request = bridge_request({ name: 'scenarios/product_search' }, token: valid_token)
    arbitrary_ruby_request = bridge_request({ name: 'eval', options: 'Product.delete_all' }, token: valid_token)
    traversal_request = bridge_request({ name: '../config/environment' }, token: valid_token)
    alternate_path_request = bridge_request({ name: 'clean' }, path: '/__cypress__/command', token: valid_token)

    expect(E2ERailsBridge.authorize(clean_request, expected_token: valid_token)).to be_nil
    expect(E2ERailsBridge.authorize(scenario_request, expected_token: valid_token)).to be_nil
    expect(E2ERailsBridge.authorize(arbitrary_ruby_request, expected_token: valid_token))
      .to match([403, anything, ['Forbidden']])
    expect(E2ERailsBridge.authorize(traversal_request, expected_token: valid_token))
      .to match([403, anything, ['Forbidden']])
    expect(E2ERailsBridge.authorize(alternate_path_request, expected_token: valid_token))
      .to match([403, anything, ['Forbidden']])
  end

  it 'rejects missing or wrong capability tokens' do
    missing_token = bridge_request({ name: 'clean' })
    wrong_token = bridge_request({ name: 'clean' }, token: 'b' * 64)

    expect(E2ERailsBridge.authorize(missing_token, expected_token: valid_token))
      .to match([403, anything, ['Forbidden']])
    expect(E2ERailsBridge.authorize(wrong_token, expected_token: valid_token))
      .to match([403, anything, ['Forbidden']])
  end

  it 'rejects browser-originated and non-JSON requests' do
    hostile_origin = bridge_request({ name: 'clean' }, token: valid_token, origin: 'https://attacker.example')
    simple_post = bridge_request({ name: 'clean' }, token: valid_token, content_type: 'text/plain')

    expect(E2ERailsBridge.authorize(hostile_origin, expected_token: valid_token))
      .to match([403, anything, ['Forbidden']])
    expect(E2ERailsBridge.authorize(simple_post, expected_token: valid_token))
      .to match([403, anything, ['Forbidden']])
  end

  it 'rejects malformed command payloads and non-POST requests' do
    malformed_request = Rack::Request.new(
      'REMOTE_ADDR' => '127.0.0.1',
      'REQUEST_METHOD' => 'POST',
      'PATH_INFO' => E2ERailsBridge::COMMAND_PATH,
      'CONTENT_TYPE' => 'application/json',
      'HTTP_X_E2E_RAILS_TOKEN' => valid_token,
      'rack.input' => StringIO.new('{')
    )
    get_request = Rack::Request.new(
      'REMOTE_ADDR' => '127.0.0.1',
      'REQUEST_METHOD' => 'GET',
      'PATH_INFO' => E2ERailsBridge::COMMAND_PATH,
      'CONTENT_TYPE' => 'application/json',
      'HTTP_X_E2E_RAILS_TOKEN' => valid_token,
      'rack.input' => StringIO.new
    )

    expect(E2ERailsBridge.authorize(malformed_request, expected_token: valid_token))
      .to match([400, anything, ['Bad Request']])
    expect(E2ERailsBridge.authorize(get_request, expected_token: valid_token))
      .to match([405, anything, ['Method Not Allowed']])
  end

  it 'configures the managed Rails server on a fixed loopback endpoint' do
    configuration = CypressOnRails.configuration

    expect(configuration.install_folder).to eq(Rails.root.join('e2e').to_s)
    expect(configuration.server_host).to eq('127.0.0.1')
    expect(configuration.server_port).to eq(5017)
    expect(configuration.server_readiness_path).to eq('/up')
  end

  it 'binds and waits for the renderer on the same fixed loopback endpoint' do
    runner = Rails.root.join('e2e/run-playwright').read

    expect(runner).to include('export RENDERER_HOST=127.0.0.1')
    expect(runner).to include('>"/dev/tcp/${RENDERER_HOST}/${RENDERER_PORT}"')
    expect(runner).to match(
      %r{curl .*"\$\{E2E_BASE_URL\}/up".*&&.*/dev/tcp/\$\{RENDERER_HOST\}/\$\{RENDERER_PORT\}}m
    )
  end

  it 'bounds a Rails readiness probe when a listener accepts but never responds' do
    runner = Rails.root.join('e2e/run-playwright').read
    timeout_options = runner.match(
      /curl --fail --silent --show-error --connect-timeout (?<connect>\d+) --max-time (?<transfer>\d+)/
    )
    listener = TCPServer.new('127.0.0.1', 0)
    accepted_socket = nil
    server_thread = Thread.new do
      accepted_socket = listener.accept
      sleep 10
    end
    started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    expect(timeout_options).not_to be_nil
    _stdout, _stderr, status = Open3.capture3(
      'curl',
      '--fail',
      '--silent',
      '--show-error',
      '--connect-timeout',
      timeout_options[:connect],
      '--max-time',
      timeout_options[:transfer],
      "http://127.0.0.1:#{listener.local_address.ip_port}/up"
    )
    elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started_at

    expect(status).not_to be_success
    expect(elapsed).to be < timeout_options[:transfer].to_f + 1.5
  ensure
    server_thread&.kill
    server_thread&.join
    accepted_socket&.close
    listener&.close
  end

  it 'removes the Rails command capability from the renderer process' do
    runner = Rails.root.join('e2e/run-playwright').read
    security_boundary = Rails.root.join('e2e/README.md').read
    normalized_boundary = security_boundary.split.join(' ')

    expect(runner).to include('env -u E2E_RAILS_TOKEN node node-renderer.js')
    expect(runner).not_to match(/^node node-renderer\.js/m)
    expect(normalized_boundary).to include(
      "only the Rails process's guarded command middleware and Playwright's Node request client receive it"
    )
    expect(normalized_boundary).to include(
      'The node renderer, browser, and page JavaScript do not receive the token.'
    )
  end

  it 'refuses to continue when a managed loopback port already has a listener' do
    listener = TCPServer.new('127.0.0.1', 0)
    port = listener.local_address.ip_port
    port_guard = Rails.root.join('e2e/bin/require-open-port').to_s

    stdout, stderr, status = Open3.capture3(port_guard, '127.0.0.1', port.to_s)

    expect(status).not_to be_success
    expect([stdout, stderr].join("\n")).to include("127.0.0.1:#{port} is already in use")
  ensure
    listener&.close
  end

  it 'allows only one runner to own the shared E2E stack' do
    lock_helper = Rails.root.join('e2e/bin/with-runner-lock').to_s
    lock_name = "marketplace-rsc-playwright-spec-#{Process.pid}"
    first_stdin, first_stdout, first_stderr, first_wait = Open3.popen3(
      lock_helper,
      lock_name,
      RbConfig.ruby,
      '-e',
      '$stdout.sync = true; puts "locked"; sleep 30'
    )
    expect(first_stdout.gets).to eq("locked\n")

    second_stdout, second_stderr, second_status = Open3.capture3(
      lock_helper,
      lock_name,
      RbConfig.ruby,
      '-e',
      'abort "second runner executed"'
    )

    expect(second_status).not_to be_success
    expect([second_stdout, second_stderr].join("\n")).to include('another Playwright E2E runner is active')
  ensure
    first_stdin&.close
    Process.kill('TERM', first_wait.pid) if first_wait&.alive?
    first_wait&.value
    first_stdout&.close
    first_stderr&.close
  end

  it 'boundedly terminates and reaps every managed child during cleanup' do
    cleanup_helper = Rails.root.join('e2e/bin/process-cleanup')
    runner = Rails.root.join('e2e/run-playwright').read

    expect(cleanup_helper).to exist
    expect(runner).to include('source "${repo_root}/e2e/bin/process-cleanup"')
    expect(runner).to include('local exit_status=$?')
    expect(runner).to include('trap - EXIT')
    expect(runner).to include(
      'stop_children "${renderer_pid}:${renderer_pgid}" "${rails_pid}:${rails_pgid}"'
    )
    expect(runner).to include('exit "${exit_status}"')
    expect(runner).to include("trap 'exit 130' INT")
    expect(runner).to include("trap 'exit 143' TERM")
    expect(runner).to match(
      /set\ -m\n
       .*renderer_pid=\$!\n
       renderer_pgid="\$\{renderer_pid\}"
       .*rails_pid=\$!\n
       rails_pgid="\$\{rails_pid\}"\n
       set\ \+m/mx
    )

    started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    stdout, stderr, status = Open3.capture3(
      { 'E2E_CHILD_STOP_TIMEOUT_SECONDS' => '1' },
      'bash',
      '-c',
      <<~'BASH',
        set -euo pipefail

        source "$1"
        temp_dir="$(mktemp -d)"
        fixture_pids=()

        cleanup_fixtures() {
          local pid

          trap - EXIT
          for pid in "${fixture_pids[@]}"; do
            kill -KILL -- "-${pid}" 2>/dev/null || kill -KILL "${pid}" 2>/dev/null || true
          done
          for pid in "${fixture_pids[@]}"; do
            wait "${pid}" 2>/dev/null || true
          done
          rm -f -- "${temp_dir}"/*.port
          rmdir -- "${temp_dir}"
        }
        trap cleanup_fixtures EXIT

        start_child() {
          local mode="$1"
          local child_group
          local port_file="${temp_dir}/${mode}.port"

          ruby -rsocket -e '
            mode, port_file = ARGV
            mode == "cooperative" ? trap("TERM") { exit } : trap("TERM", "IGNORE")
            listener = TCPServer.new("127.0.0.1", 0)
            worker_pid =
              if mode != "cooperative"
                fork do
                  trap("TERM", "IGNORE")
                  sleep
                end
              end
            File.write(port_file, "#{listener.local_address.ip_port} #{worker_pid || "-"}\n")
            exit if mode == "exited-leader"
            sleep
          ' "${mode}" "${port_file}" &
          child_pid=$!
          fixture_pids+=("${child_pid}")

          for _ in {1..50}; do
            [[ -s "${port_file}" ]] && break
            sleep 0.05
          done
          [[ -s "${port_file}" ]]

          if [[ "${mode}" == "exited-leader" ]]; then
            wait "${child_pid}"
            read -r _ descendant_pid < "${port_file}"
            child_group="$(ps -o pgid= -p "${descendant_pid}" | tr -d '[:space:]')"
          else
            child_group="$(ps -o pgid= -p "${child_pid}" | tr -d '[:space:]')"
          fi
          [[ "${child_group}" == "${child_pid}" ]]
          [[ "${child_group}" != "$(ps -o pgid= -p "$$" | tr -d '[:space:]')" ]]
        }

        verify_stopped_child() {
          local mode="$1"
          local child_pid="$2"
          local descendant_pid
          local port

          ! kill -0 "${child_pid}" 2>/dev/null
          read -r port descendant_pid < "${temp_dir}/${mode}.port"
          if [[ "${descendant_pid}" != "-" ]]; then
            for _ in {1..50}; do
              ! kill -0 "${descendant_pid}" 2>/dev/null && break
              sleep 0.05
            done
            ! kill -0 "${descendant_pid}" 2>/dev/null
          fi
          ruby -rsocket -e '
            listener = TCPServer.new("127.0.0.1", ARGV.fetch(0).to_i)
            listener.close
          ' "${port}"
        }

        set -m
        start_child cooperative
        cooperative_pid="${child_pid}"
        start_child ignoring
        ignoring_pid="${child_pid}"
        start_child exited-leader
        exited_leader_pid="${child_pid}"
        set +m
        true &
        already_exited_pid=$!
        sleep 0.05

        stop_children \
          "" \
          "${already_exited_pid}" \
          "${cooperative_pid}:${cooperative_pid}" \
          "${ignoring_pid}:${ignoring_pid}" \
          "${exited_leader_pid}:${exited_leader_pid}"
        ! kill -0 "${already_exited_pid}" 2>/dev/null
        verify_stopped_child cooperative "${cooperative_pid}"
        verify_stopped_child ignoring "${ignoring_pid}"
        verify_stopped_child exited-leader "${exited_leader_pid}"
      BASH
      'process-cleanup-spec',
      cleanup_helper.to_s
    )
    elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started_at

    expect(status).to be_success, [stdout, stderr].join("\n")
    expect(elapsed).to be < 4

    exit_stdout, exit_stderr, exit_status = Open3.capture3(
      { 'E2E_CHILD_STOP_TIMEOUT_SECONDS' => '1' },
      'bash',
      '-c',
      <<~'BASH',
        set -euo pipefail

        source "$1"
        child_pid=""
        cleanup() {
          local original_status=$?

          trap - EXIT
          trap '' INT TERM
          stop_children "${child_pid}"
          exit "${original_status}"
        }
        trap cleanup EXIT

        set -m
        sleep 30 &
        child_pid=$!
        set +m
        printf '%s\n' "${child_pid}"
        exit 42
      BASH
      'process-cleanup-status-spec',
      cleanup_helper.to_s
    )
    cleaned_pid = Integer(exit_stdout)

    expect(exit_status.exitstatus).to eq(42), exit_stderr
    expect { Process.kill(0, cleaned_pid) }.to raise_error(Errno::ESRCH)
  end

  it 'locks the shared stack and checks both managed ports before destructive setup' do
    runner = Rails.root.join('e2e/run-playwright').read
    runner_lock_offset = runner.index('with-runner-lock marketplace-rsc-playwright-5017-3800')
    rails_port_guard_offset = runner.index('require-open-port 127.0.0.1 5017')
    renderer_port_guard_offset = runner.index('require-open-port 127.0.0.1 3800')
    database_preflight_offset = runner.index('database_name=')

    expect(runner_lock_offset).not_to be_nil
    expect(rails_port_guard_offset).not_to be_nil
    expect(renderer_port_guard_offset).not_to be_nil
    expect(database_preflight_offset).not_to be_nil
    expect(runner_lock_offset).to be < rails_port_guard_offset
    expect(runner_lock_offset).to be < renderer_port_guard_offset
    expect(rails_port_guard_offset).to be < database_preflight_offset
    expect(renderer_port_guard_offset).to be < database_preflight_offset
  end

  it 'generates React on Rails packs before compiling the E2E bundles' do
    runner = Rails.root.join('e2e/run-playwright').read
    generation_offset = runner.index('bundle exec rake react_on_rails:generate_packs')
    compilation_offset = runner.index('bin/shakapacker')

    expect(generation_offset).not_to be_nil
    expect(compilation_offset).not_to be_nil
    expect(generation_offset).to be < compilation_offset
  end

  it 'uses the non-instrumented Rails command client contract' do
    stdout, stderr, status = Open3.capture3(
      'node',
      '--test',
      Rails.root.join('e2e/playwright/support/on-rails.test.mjs').to_s,
      chdir: Rails.root.to_s
    )

    expect(status).to be_success, [stdout, stderr].join("\n")
  end

  it 'can load the product scenarios repeatedly without accumulating fixtures' do
    scenario_path = Rails.root.join('e2e/app_commands/scenarios/product_search.rb')

    2.times { load scenario_path }

    expect(Product.count).to eq(28)
    expect(Product.distinct.count(:sku)).to eq(28)
    expect(ProductReview.count).to eq(2)
    expect(Product.find_by!(sku: 'E2E-PRODUCT-PAGE')).to have_attributes(
      name: 'E2E Product Page Headphones',
      stock_quantity: 3,
      in_stock: true
    )
    expect(Product.find_by!(sku: 'E2E-PRODUCT-UNAVAILABLE')).to have_attributes(
      stock_quantity: 0,
      in_stock: false
    )
  ensure
    load Rails.root.join('e2e/app_commands/clean.rb')
  end

  it 'prepares the hosted test database before loading the bridge spec' do
    workflow = Rails.root.join('.github/workflows/playwright-e2e.yml').read
    prepare_offset = workflow.index('name: Prepare test database')
    foundation_offset = workflow.index('name: Verify the Rails command bridge contract')

    expect(prepare_offset).not_to be_nil
    expect(foundation_offset).not_to be_nil
    expect(prepare_offset).to be < foundation_offset
  end

  it 'runs the E2E type and lint gates in hosted and canonical validation' do
    package_scripts = JSON.parse(Rails.root.join('package.json').read).fetch('scripts')
    runtime_type_config = JSON.parse(Rails.root.join('e2e/tsconfig.runtime.json').read)
    workflow = Rails.root.join('.github/workflows/playwright-e2e.yml').read
    validation = Rails.root.join('script/demo-fleet-verify').read
    static_gate_offset = workflow.index('name: Check Playwright types and lint')
    browser_offset = workflow.index('name: Run the product-search browser journey')

    expect(package_scripts.fetch('type-check:e2e')).to include('e2e/tsconfig.json')
    expect(package_scripts.fetch('type-check:e2e')).to include('e2e/tsconfig.runtime.json')
    expect(runtime_type_config.fetch('files')).to include('playwright/support/on-rails.mjs')
    expect(package_scripts.fetch('lint:e2e')).to include('e2e/**/*.{js,mjs,ts,mts}')
    expect(package_scripts.fetch('test:e2e:unit')).to include('e2e/playwright/support/*.test.mjs')
    expect(static_gate_offset).not_to be_nil
    expect(browser_offset).not_to be_nil
    expect(static_gate_offset).to be < browser_offset
    expect(workflow).to include('run: pnpm type-check:e2e && pnpm lint:e2e && pnpm test:e2e:unit')
    expect(validation).to include("pnpm type-check:e2e\npnpm lint:e2e\npnpm test:e2e:unit")
  end

  it 'mounts only the guarded command middleware when opted in' do
    stdout, stderr, status = Open3.capture3(
      {
        'E2E_RAILS_COMMANDS' => '1',
        'E2E_RAILS_TOKEN' => valid_token,
        'RAILS_ENV' => 'test'
      },
      'bundle',
      'exec',
      'rails',
      'runner',
      <<~'RUBY',
        middleware_names = Rails.application.middleware.middlewares.map { |middleware| middleware.klass.name }
        abort 'command middleware missing' unless middleware_names.include?('CypressOnRails::Middleware')
        abort 'unsafe reset middleware mounted' if middleware_names.include?('CypressOnRails::StateResetMiddleware')

        request = Rack::MockRequest.new(Rails.application)
        [
          ['missing', nil],
          ['invalid', 'b' * 64]
        ].each do |label, token|
          product = Product.create!(
            name: "#{label} token guard",
            description: 'must survive',
            price: 1,
            category: 'E2E',
            brand: 'E2E',
            sku: "#{label.upcase}-TOKEN-GUARD-#{SecureRandom.hex(8)}"
          )
          request_options = {
            'REMOTE_ADDR' => '127.0.0.1',
            'CONTENT_TYPE' => 'application/json',
            input: { name: 'clean' }.to_json
          }
          request_options['HTTP_X_E2E_RAILS_TOKEN'] = token if token

          response = request.post(E2ERailsBridge::COMMAND_PATH, request_options)
          abort "#{label} token request was not forbidden" unless response.status == 403
          abort "#{label} token request executed clean" unless Product.exists?(product.id)
          product.destroy!
        end

        ['/__cypress__/reset_state', '/cypress_rails_reset_state'].each do |path|
          product = Product.create!(
            name: 'reset guard',
            description: 'must survive',
            price: 1,
            category: 'E2E',
            brand: 'E2E',
            sku: "RESET-GUARD-#{SecureRandom.hex(8)}"
          )
          response = request.post(path)
          abort "unsafe reset endpoint active: #{path}" if response.body == 'State reset completed'
          abort "reset endpoint deleted data: #{path}" unless Product.exists?(product.id)
          product.destroy!
        end
      RUBY
      chdir: Rails.root.to_s
    )

    expect(status).to be_success, [stdout, stderr].join("\n")
  end

  it 'boots production when development and test gems are excluded' do
    stdout, stderr, status = Open3.capture3(
      {
        'BUNDLE_WITHOUT' => 'development:test',
        'RAILS_ENV' => 'production',
        'SECRET_KEY_BASE' => 'e2e-production-boot-contract'
      },
      'bundle',
      'exec',
      'rails',
      'runner',
      'abort "bridge loaded" if defined?(CypressOnRails)',
      chdir: Rails.root.to_s
    )

    expect(status).to be_success, [stdout, stderr].join("\n")
  end

  def bridge_request(
    command,
    path: E2ERailsBridge::COMMAND_PATH,
    token: nil,
    content_type: 'application/json',
    origin: nil
  )
    Rack::Request.new(
      'REMOTE_ADDR' => '127.0.0.1',
      'REQUEST_METHOD' => 'POST',
      'PATH_INFO' => path,
      'CONTENT_TYPE' => content_type,
      'HTTP_ORIGIN' => origin,
      'HTTP_X_E2E_RAILS_TOKEN' => token,
      'rack.input' => StringIO.new(command.to_json)
    )
  end
end
# rubocop:enable Metrics/BlockLength
