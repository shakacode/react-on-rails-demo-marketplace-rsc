# frozen_string_literal: true

require 'spec_helper'
require 'json'
require 'open3'
require 'tmpdir'
require 'yaml'

# CI-enforced regression spec for the `detect-changes` step in
# .github/workflows/specs.yml (issue #218). It runs the REAL `run:` script —
# extracted from the workflow YAML, never a copy — under `bash -e` (GitHub's
# default shell is `bash -e {0}`), against a stub `gh` that replays JSON
# fixtures through the script's own `--jq` programs. That keeps the two #218
# properties pinned:
#   1. The truncation guard counts file ENTRIES (TSV lines), not names, so a
#      renamed file cannot inflate `listed` past `.changed_files` and mask a
#      truncated listing.
#   2. The matcher checks both sides of a rename (filename AND
#      previous_filename) against the Ruby-relevant path list.
RSpec.describe 'specs.yml detect-changes step' do
  def workflow_path
    File.expand_path('../../.github/workflows/specs.yml', __dir__)
  end

  def detect_changes_script
    workflow = YAML.load_file(workflow_path)
    workflow.fetch('jobs').fetch('detect-changes').fetch('steps').first.fetch('run')
  end

  # Stub `gh api` that pipes fixture JSON through the caller-supplied --jq
  # program, so the workflow's own jq text is what gets exercised.
  def gh_stub_script
    <<~'BASH'
      #!/usr/bin/env bash
      set -euo pipefail
      endpoint="${2:-}"
      jq_prog=""
      prev=""
      for arg in "$@"; do
        if [[ "${prev}" == "--jq" ]]; then jq_prog="${arg}"; fi
        prev="${arg}"
      done
      case "${endpoint}" in
        repos/*/pulls/*/files)
          if [[ "${GH_FILES_FAIL:-0}" == "1" ]]; then
            echo "stub gh: simulated files API failure" >&2
            exit 1
          fi
          exec jq -r "${jq_prog}" "${GH_FILES_FIXTURE}"
          ;;
        repos/*/pulls/*)
          exec jq -r "${jq_prog}" "${GH_PR_FIXTURE}"
          ;;
        *)
          echo "stub gh: unexpected invocation: $*" >&2
          exit 64
          ;;
      esac
    BASH
  end

  def write_stub_bin(dir)
    bin_dir = File.join(dir, 'bin')
    Dir.mkdir(bin_dir)
    gh_path = File.join(bin_dir, 'gh')
    File.write(gh_path, gh_stub_script)
    File.chmod(0o755, gh_path)
    bin_dir
  end

  def write_fixtures(dir, files, changed_files)
    files_fixture = File.join(dir, 'files.json')
    File.write(files_fixture, JSON.generate(files))
    pr_fixture = File.join(dir, 'pr.json')
    File.write(pr_fixture, JSON.generate('changed_files' => changed_files))
    [files_fixture, pr_fixture]
  end

  def step_env(dir, files_fixture, pr_fixture, files_fail)
    {
      'EVENT_NAME' => 'pull_request',
      'REPO' => 'o/r',
      'PR_NUMBER' => '1',
      'GH_TOKEN' => 'stub',
      'GITHUB_OUTPUT' => File.join(dir, 'github_output'),
      'PATH' => "#{write_stub_bin(dir)}:#{ENV.fetch('PATH')}",
      'GH_FILES_FIXTURE' => files_fixture,
      'GH_PR_FIXTURE' => pr_fixture,
      'GH_FILES_FAIL' => files_fail ? '1' : '0'
    }
  end

  def run_detect_changes(files:, changed_files:, files_fail: false)
    Dir.mktmpdir('detect-changes-spec') do |dir|
      script_path = File.join(dir, 'detect-step.sh')
      File.write(script_path, detect_changes_script)
      env = step_env(dir, *write_fixtures(dir, files, changed_files), files_fail)
      File.write(env.fetch('GITHUB_OUTPUT'), '')
      stdout, stderr, status = Open3.capture3(env, 'bash', '-e', script_path)
      { stdout: stdout, stderr: stderr, status: status, output: File.read(env.fetch('GITHUB_OUTPUT')) }
    end
  end

  it 'fails open when renames shrink the listing below changed_files (#218 units regression)' do
    # 3 entries (2 of them renames), but the PR object declares 5 changed
    # files — a truncated listing. The pre-fix jq emitted one line per NAME
    # (3 filenames + 2 previous names = 5), matching `declared` and silently
    # skipping specs; entry-unit counting sees 3 < 5 and fails open.
    files = [
      { 'filename' => 'README.md' },
      { 'filename' => 'docs/new-a.md', 'previous_filename' => 'docs/old-a.md' },
      { 'filename' => 'notes/new-b.md', 'previous_filename' => 'notes/old-b.md' }
    ]
    result = run_detect_changes(files: files, changed_files: 5)

    expect(result.fetch(:status)).to be_success
    expect(result.fetch(:stdout)).to include('File listing incomplete (3/5)')
    expect(result.fetch(:output)).to eq("ruby=true\n")
  end

  it 'detects a rename OUT of a Ruby-relevant path via previous_filename' do
    files = [{ 'filename' => 'scripts/foo.rb', 'previous_filename' => 'lib/foo.rb' }]
    result = run_detect_changes(files: files, changed_files: 1)

    expect(result.fetch(:status)).to be_success
    expect(result.fetch(:stdout)).to include('Ruby-relevant change detected: true')
    expect(result.fetch(:output)).to eq("ruby=true\n")
  end

  it 'detects a rename INTO a Ruby-relevant path via filename' do
    files = [{ 'filename' => 'spec/a_spec.rb', 'previous_filename' => 'docs/a.md' }]
    result = run_detect_changes(files: files, changed_files: 1)

    expect(result.fetch(:status)).to be_success
    expect(result.fetch(:output)).to eq("ruby=true\n")
  end

  it 'reports ruby=false when only irrelevant paths changed' do
    files = [{ 'filename' => 'README.md' }, { 'filename' => 'docs/x.md' }]
    result = run_detect_changes(files: files, changed_files: 2)

    expect(result.fetch(:status)).to be_success
    expect(result.fetch(:stdout)).to include('Ruby-relevant change detected: false')
    expect(result.fetch(:output)).to eq("ruby=false\n")
  end

  it 'handles a zero-file PR without failing' do
    result = run_detect_changes(files: [], changed_files: 0)

    expect(result.fetch(:status)).to be_success
    expect(result.fetch(:output)).to eq("ruby=false\n")
  end

  it 'fails open when the files API call fails' do
    result = run_detect_changes(files: [], changed_files: 0, files_fail: true)

    expect(result.fetch(:status)).to be_success
    expect(result.fetch(:stdout)).to include('Could not list PR files')
    expect(result.fetch(:output)).to eq("ruby=true\n")
  end
end
