import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { CacheProvider, ClassNames } from "@emotion/react";
import createCache from "@emotion/cache";
import { BrowserWindowPortal } from "./BrowserWindowPortal";

// A popped-out panel is rendered into a blank window, which gets the page's styles. In a
// production build emotion (Chakra) writes its rules with insertRule, so its <style> tags
// have no text: copying their text gave a popped-out window without Chakra's styles.

const cssOf = (doc) =>
  Array.from(doc.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .map((rule) => rule.cssText)
    .join("\n");

let frame;
const popupWindow = () => {
  frame = document.createElement("iframe");
  document.body.appendChild(frame);
  vi.spyOn(window, "open").mockReturnValue(frame.contentWindow);
  return frame.contentWindow;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  frame?.remove();
  document.head.querySelectorAll("style[data-test]").forEach((s) => s.remove());
});

describe("BrowserWindowPortal", () => {
  it("copies rules written with insertRule (no text in the <style> tag)", async () => {
    const style = document.createElement("style");
    style.setAttribute("data-test", "");
    document.head.appendChild(style);
    style.sheet.insertRule(".from-insert-rule { color: red; }", 0);
    expect(style.textContent).toBe("");

    const win = popupWindow();
    render(<BrowserWindowPortal title="Dice">content</BrowserWindowPortal>);
    await waitFor(() => expect(win.document.body.textContent).toContain("content"));
    expect(cssOf(win.document)).toContain(".from-insert-rule");
  });

  it("styles of the panel's own components land in the popped-out window", async () => {
    // The app's cache as in a production build: rules go in with insertRule.
    const appCache = createCache({ key: "app", speedy: true });
    const win = popupWindow();
    render(
      <CacheProvider value={appCache}>
        <BrowserWindowPortal title="Dice">
          <ClassNames>{({ css }) => <div className={css({ outlineWidth: "7px" })}>styled</div>}</ClassNames>
        </BrowserWindowPortal>
      </CacheProvider>,
    );
    await waitFor(() => expect(win.document.body.textContent).toContain("styled"));
    expect(cssOf(win.document)).toContain("outline-width: 7px");
  });
});
