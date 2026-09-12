# frozen_string_literal: true

require 'rails_helper'

# Unit coverage for the shared page-clamping seam (issue #239). The request
# specs prove the four HTTP surfaces use it; the edge semantics of the
# coercion itself are pinned here, where every shape is cheap to enumerate.
RSpec.describe SearchPagination do
  describe '.clamp_page' do
    it 'passes ordinary pages through unchanged' do
      expect(described_class.clamp_page('2')).to eq(2)
      expect(described_class.clamp_page(42)).to eq(42)
      expect(described_class.clamp_page('  42  ')).to eq(42)
    end

    it 'clamps nil, blank, zero, negative, and non-numeric input to 1' do
      [nil, '', '   ', '0', '-1', '-0', 'abc', 'abc12', '٤٢', '１２'].each do |raw|
        expect(described_class.clamp_page(raw)).to eq(1), "expected #{raw.inspect} to clamp to 1"
      end
    end

    it 'clamps anything above MAX_PAGE to MAX_PAGE' do
      expect(described_class.clamp_page('100001')).to eq(described_class::MAX_PAGE)
      expect(described_class.clamp_page('99999999999999999999')).to eq(described_class::MAX_PAGE)
      expect(described_class.clamp_page(10**30)).to eq(described_class::MAX_PAGE)
    end

    it 'keeps String#to_i semantics for leading integers and trailing garbage' do
      expect(described_class.clamp_page('12abc')).to eq(12)
      expect(described_class.clamp_page('3.9')).to eq(3)
      expect(described_class.clamp_page('+5')).to eq(5)
      expect(described_class.clamp_page('0000012345')).to eq(12_345)
    end

    it 'does not honor Ruby integer-literal underscores' do
      # "1_000".to_i is 1000 — a Ruby-literal quirk, not part of the HTTP
      # contract. The bounded parser reads the leading integer only.
      expect(described_class.clamp_page('1_000')).to eq(1)
    end

    it 'clamps non-scalar values that slip past params.permit to 1' do
      # A raise here would surface through the eq(1) expectation.
      [[], {}, [1, 2], :symbol, Object.new].each do |raw|
        expect(described_class.clamp_page(raw)).to eq(1)
      end
    end

    it 'clamps invalid-encoding bytes to 1 without raising' do
      # See the scrub in SearchPagination.clamp_page.
      invalid = (+"\xFF12").force_encoding(Encoding::UTF_8)
      expect(invalid.valid_encoding?).to be(false)
      expect(described_class.clamp_page(invalid)).to eq(1)
    end

    it 'handles unbounded input in constant work via the parse window' do
      # See SearchPagination::PAGE_WINDOW for the cost rationale; digits
      # starting beyond the window read as page 1 rather than being
      # searched for.
      expect(described_class.clamp_page('9' * 1_000_000)).to eq(described_class::MAX_PAGE)
      expect(described_class.clamp_page('0' * 1_000_000)).to eq(1)
      expect(described_class.clamp_page("#{'0' * 1_000_000}12345")).to eq(1)
      expect(described_class.clamp_page("#{'0' * (described_class::PAGE_WINDOW - 6)}12345")).to eq(12_345)
    end
  end
end
