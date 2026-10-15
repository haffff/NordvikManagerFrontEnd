// An http(s) URL safe to open in a new tab, or null. Use it for links that come from
// outside data (addon metadata, profiles): a javascript: or data: URL would run in
// the app's origin, and React 18 still renders them in href.
export function safeExternalUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
