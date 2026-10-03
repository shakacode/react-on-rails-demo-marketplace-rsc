# frozen_string_literal: true

require 'spec_helper'
require 'yaml'

RSpec.describe 'RSC + Rspack published package gate' do
  let(:steps) do
    path = File.expand_path('../../.github/workflows/rsc-rspack-e2e.yml', __dir__)
    YAML.load_file(path).fetch('jobs').fetch('e2e').fetch('steps')
  end

  it 'uses the frozen committed graph for the normal route gate' do
    install = steps.find { |step| step['name'] == 'Verify committed demo dependency graph' }
    gate = steps.find { |step| step['name'] == 'Run RSC + Rspack E2E gate' }
    expect(install.fetch('run')).to eq('pnpm install --frozen-lockfile')
    expect(install).not_to have_key('if')
    expect(gate).not_to have_key('if')
  end

  it 'restricts every package substitution to explicit manual source diagnostics' do
    names = ['Install yalc', 'Checkout react_on_rails (Pro packages)',
             'Build + yalc publish Pro packages', 'Checkout react_on_rails_rsc (RSCRspackPlugin)',
             'Build + yalc publish react-on-rails-rsc', 'Link packages + install']
    source_steps = steps.select { |step| names.include?(step['name']) }
    expect(source_steps.size).to eq(names.size)
    source_steps.each do |step|
      expect(step.fetch('if')).to eq(
        "github.event_name == 'workflow_dispatch' && (inputs.ror_ref != '' || inputs.rsc_ref != '')"
      )
    end
  end
end
