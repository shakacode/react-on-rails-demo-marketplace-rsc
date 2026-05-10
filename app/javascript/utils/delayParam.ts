export function appendDelay(url: string): string {
  if (typeof window === 'undefined') return url;
  const delay = new URLSearchParams(window.location.search).get('delay');
  if (!delay) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}delay=${delay}`;
}
