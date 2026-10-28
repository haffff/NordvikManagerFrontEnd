// Small, stateless helpers for mutating the current URL's query string without
// a full navigation — used both for GM auto-join's bidirectional URL sync
// (MainApp.js) and to fix RegisterForm/PlayerRegisterForm, which used to
// blanket-clear the *entire* query string (destroying any other param, e.g.
// a `game` deep link, sitting alongside `code`) instead of removing just the
// one param they meant to consume.

export function setUrlParam(name, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
}

export function removeUrlParam(name) {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
}
