import { appliedGameCss, onGameCssChange } from "./cardAppStyles";

/**
 * Gives a popped-out window the game's custom CSS (GM and personal
 * stylesheets, e.g. a theme addon) and keeps it in sync. GameStylesheets
 * applies that CSS through the main document's adoptedStyleSheets, which a
 * window copying the page's <style>/<link> tags never sees — and a
 * constructed sheet can't be shared across documents, so the window gets its
 * own, built in its own realm from the already-sanitised text.
 * Returns the cleanup.
 */
export function mirrorGameCss(win) {
  const doc = win?.document;
  if (!doc || !("adoptedStyleSheets" in doc) || typeof win.CSSStyleSheet !== "function") return () => {};

  const sheet = new win.CSSStyleSheet();
  const apply = (css) => {
    try {
      sheet.replaceSync(css ?? "");
    } catch (e) {
      console.warn("Popout window: game stylesheet could not be applied", e);
    }
  };
  apply(appliedGameCss());
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];

  const unsubscribe = onGameCssChange(apply);
  return () => {
    unsubscribe();
    try {
      doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
    } catch {
      /* the window is already closed */
    }
  };
}
