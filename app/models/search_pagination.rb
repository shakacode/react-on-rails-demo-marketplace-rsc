# frozen_string_literal: true

# Shared page-clamping and offset arithmetic for the product-search surfaces:
# the public API controller, the SSR controller, and the RSC ERB emit blocks
# (issue #239). A `page` that is non-numeric or below 1 clamps to 1
# (Kaminari-style) and an absurdly large one clamps to MAX_PAGE, so malformed
# input can never become a negative or overflowing SQL OFFSET. Valid pages
# behave as before, including a beyond-last-page request returning an empty
# result set.
module SearchPagination
  # Upper bound for a requested page. These surfaces take unauthenticated
  # input, and an unbounded page overflows PostgreSQL's bigint OFFSET
  # (ActiveRecord::RangeError → 500). 100_000 keeps the offset far inside
  # bigint range while leaving realistic beyond-last-page requests (say,
  # page=5000) unchanged: still 200 with empty results and a current_page
  # echoing the request.
  MAX_PAGE = 100_000

  # Leading integer of the raw param: optional whitespace and "+", leading
  # zeros skipped, then at most 7 significant digits — one more digit than
  # MAX_PAGE needs, so any longer number still clamps to MAX_PAGE. Trailing
  # garbage stops the match, mirroring String#to_i ("12abc" => 12);
  # Ruby-literal quirks like "1_000" deliberately do not parse as 1000.
  LEADING_PAGE_DIGITS = /\A\s*\+?0*(\d{1,7})/

  # The parser only ever looks at this many leading characters, so the cost
  # of clamping is constant no matter how long the raw param is. The old
  # `.to_i.clamp` paid a full bignum conversion first (~100ms for a million
  # attacker-supplied digits on this unauthenticated surface), and even an
  # unwindowed regex pays a linear scan over a million leading zeros. Any
  # sane page number — whitespace, a sign, a few leading zeros, 6 digits —
  # fits comfortably; a param whose digits start beyond the window is page 1.
  PAGE_WINDOW = 32

  module_function

  # Coerces a raw `page` param to a usable page number. Never raises: a
  # non-scalar that slipped past permit stringifies, `scrub` disarms invalid
  # encoding (a raw "%FF" query byte would make the regex itself raise
  # ArgumentError), and anything without a usable leading integer is page 1.
  def clamp_page(raw_page)
    digits = raw_page.to_s[0, PAGE_WINDOW].to_s.scrub[LEADING_PAGE_DIGITS, 1]
    digits ? digits.to_i.clamp(1, MAX_PAGE) : 1
  end

  # Applies the clamped page to `scope` and returns `[records, pagination]`,
  # where `pagination` is the metadata hash every surface embeds verbatim.
  def paginate(scope, page:, per_page:)
    current_page = clamp_page(page)
    total = scope.count
    records = scope.offset((current_page - 1) * per_page).limit(per_page)

    [records, {
      current_page: current_page,
      total_pages: (total / per_page.to_f).ceil,
      total_count: total,
      per_page: per_page
    }]
  end
end
