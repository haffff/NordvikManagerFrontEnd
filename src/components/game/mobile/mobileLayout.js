import { LayoutHelper } from "../../../helpers/LayoutCloneHelper";
import { openTab, activateTab } from "./mobileTabs";

/**
 * Opens the panels of a saved layout as mobile tabs (the first one active) instead of
 * arranging them in the dock — on a phone, the layout the GM set up is what the player
 * starts with (often the only way they get a battle map). Accepts the layout object or
 * its JSON. Returns how many panels it opened.
 */
export function openLayoutAsTabs(layout, createElement, resolveKey = LayoutHelper._resolvePanelKey) {
  let parsed = layout;
  if (typeof layout === "string") {
    try {
      parsed = JSON.parse(layout);
    } catch (e) {
      console.warn("openLayoutAsTabs: layout is not valid JSON", e);
      return 0;
    }
  }
  const contents = Array.isArray(parsed?._contents) ? parsed._contents : [];

  let firstId = null;
  for (const content of contents) {
    const element = createElement(content);
    if (!element) continue;
    const id = openTab(element, resolveKey);
    firstId ??= id;
  }
  if (firstId) activateTab(firstId);
  return contents.length;
}
