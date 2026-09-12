# frozen_string_literal: true

# Shared page-clamping and offset arithmetic for the product-search surfaces:
# the public API controller, the SSR controller, and the RSC ERB emit blocks
# (issue #239). A `page` that is non-numeric or below 1 clamps to 1
# (Kaminari-style) and one above MAX_PAGE clamps to MAX_PAGE, so malformed
# input can never become a negative or overflowing SQL OFFSET.
module SearchPagination
  # Upper bound for a requested page. These surfaces take unauthenticated
  # input, and an unbounded page overflows PostgreSQL's bigint OFFSET
  # (ActiveRecord::RangeError → 500). 100_000 keeps the offset far inside
  # bigint range while leaving realistic beyond-last-page requests (say,
  # page=5000) unchanged: still 200 with empty results and a current_page
  # echoing the request.
  MAX_PAGE = 100_000

  # Page size shared by every product-search surface. The SSR/API controllers
  # alias it and the RSC emit blocks take it as the default, so the rendering
  # variants being compared cannot drift apart.
  DEFAULT_PER_PAGE = 24

  # Leading integer of the raw param: optional whitespace and "+", then
  # digits. Trailing garbage stops the match, mirroring String#to_i
  # ("12abc" => 12); Ruby-literal quirks like "1_000" deliberately do not
  # parse as 1000.
  LEADING_PAGE_DIGITS = /\A\s*\+?0*(\d+)/

  # The parser only ever looks at this many leading characters, so the cost
  # of clamping is constant no matter how long the raw param is. The old
  # `.to_i.clamp` paid a full bignum conversion first (~100ms for a million
  # attacker-supplied digits on this unauthenticated surface), and even an
  # unwindowed regex pays a linear scan over a million leading zeros. Any
  # sane page number — whitespace, a sign, a few leading zeros, 6 digits —
  # fits comfortably; a param whose digits start beyond the window is page 1.
  PAGE_WINDOW = 32

  module_function

  # Coerces a raw `page` param to a usable page number. Never raises for any
  # HTTP-reachable value: a non-scalar that slipped past permit stringifies,
  # and `scrub` disarms invalid UTF-8 (which would make the regex itself
  # raise ArgumentError). No leading integer parses to 0, which clamps to 1.
  def clamp_page(raw_page)
    raw_page.to_s[0, PAGE_WINDOW].scrub[LEADING_PAGE_DIGITS, 1].to_i.clamp(1, MAX_PAGE)
  end

  # Applies the clamped page to `scope` and returns `[records, pagination]`,
  # where `pagination` is the metadata hash every surface embeds verbatim.
  def paginate(scope, page:, per_page: DEFAULT_PER_PAGE)
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
