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

  module_function

  # Coerces a raw `page` param (String, Integer, or nil) to a usable page number.
  def clamp_page(raw_page)
    raw_page.to_i.clamp(1, MAX_PAGE)
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
