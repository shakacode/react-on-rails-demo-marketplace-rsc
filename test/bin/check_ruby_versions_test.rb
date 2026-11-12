# frozen_string_literal: true

require 'fileutils'
require 'minitest/autorun'
require 'open3'
require 'rbconfig'
require 'tmpdir'

# Exercises the repository-level Ruby declaration consistency check.
class CheckRubyVersionsTest < Minitest::Test
  CHECKER = File.expand_path('../../bin/check-ruby-versions', __dir__)

  def test_accepts_non_adjacent_dockerfile_version_declarations
    stdout, stderr, status = run_checker(<<~DOCKERFILE)
      ARG RUBY_VERSION=3.4.6

      # Keep the base image declaration readable and independently documented.
      FROM ruby:${RUBY_VERSION}-slim AS base
    DOCKERFILE

    assert_predicate status, :success?, stderr
    assert_includes stdout, 'Ruby version declarations agree: 3.4.6'
  end

  def test_requires_dockerfile_base_image_to_use_the_version_argument
    _stdout, stderr, status = run_checker(<<~DOCKERFILE)
      ARG RUBY_VERSION=3.4.6
      FROM ruby:3.4.6-slim AS base
    DOCKERFILE

    assert_equal false, status.success?
    assert_includes stderr, 'could not find the Ruby version in .controlplane/Dockerfile'
  end

  def test_rejects_a_stale_version_before_a_duplicate_argument
    _stdout, stderr, status = run_checker(<<~DOCKERFILE)
      ARG RUBY_VERSION=3.4.6
      ARG RUBY_VERSION=3.3.0
      FROM ruby:${RUBY_VERSION}-slim AS base
    DOCKERFILE

    assert_equal false, status.success?
    assert_includes stderr, '.controlplane/Dockerfile: 3.3.0 (expected 3.4.6)'
  end

  private

  def run_checker(dockerfile)
    Dir.mktmpdir do |root|
      write_declarations(root, dockerfile)
      FileUtils.mkdir_p(File.join(root, 'bin'))
      FileUtils.cp(CHECKER, File.join(root, 'bin/check-ruby-versions'))

      Open3.capture3(RbConfig.ruby, File.join(root, 'bin/check-ruby-versions'))
    end
  end

  def write_declarations(root, dockerfile)
    write_fixture(root, 'Gemfile', "ruby '3.4.6'\n")
    write_fixture(root, 'Gemfile.lock', "RUBY VERSION\n   ruby 3.4.6\n")
    write_fixture(root, 'mise.toml', "ruby = '3.4.6'\n")
    write_fixture(root, '.controlplane/Dockerfile', dockerfile)
    write_fixture(root, 'CONTRIBUTING.md', "1. Install Ruby `3.4.6`, then install dependencies.\n")
    write_fixture(root, '.rubocop.yml', "AllCops:\n  TargetRubyVersion: 3.4\n")
  end

  def write_fixture(root, relative_path, contents)
    path = File.join(root, relative_path)
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, contents)
  end
end
