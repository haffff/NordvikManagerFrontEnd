// A stand-in for the dock's ContentContext, for panels rendered outside a
// Dockable.Container (pop-out OS windows, mobile tabs), so ctx.setTitle() and
// ctx.layoutContent.* don't crash. layoutPanel.rect carries the real size, which
// canvas panels (the battle map) size themselves from.
const NOOP = () => {};

/**
 * @param {object} o
 * @param {number} o.w, o.h      The space the panel has.
 * @param {string} [o.contentId] The content id (a battle map's PanelContentID).
 * @param {object} [o.element]   The panel's element (BasePanel reads its type).
 * @param {object} [o.panel]     The panel object; keep it the same per panel, effects key on it.
 * @param {Function} [o.setTitle]
 */
export function makePanelContentContext({ w, h, contentId, element, panel = { floating: true }, setTitle = NOOP }) {
  return {
    layoutContent: {
      panel,
      layoutPanel: { rect: { x: 0, y: 0, w, h } },
      tabIndex: 0,
      content: contentId ? { contentId, element } : null,
    },
    setTitle,
    setPreferredSize: NOOP,
  };
}

export default makePanelContentContext;
