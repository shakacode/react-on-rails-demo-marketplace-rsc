// Shared CSRF token helper — reads the Rails CSRF token from the <meta> tag
// that `csrf_meta_tags` places in <head>. Used by every form island and the
// spike mutation island for POST requests to Rails.

export function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}
