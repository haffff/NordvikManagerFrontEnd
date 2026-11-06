// The desktop toolbar's menus that addons add items to, as the mobile "+" sheet shows
// them. requiresEdit: the Addons menu, which only those who may edit the game see.
const TOOLBAR_MENUS = [
  { viewId: "game", title: "Game" },
  { viewId: "views", title: "View" },
  { viewId: "settings", title: "Settings" },
  { viewId: "layouts", title: "Layouts" },
  { viewId: "addons", title: "Addons", requiresEdit: true },
  { viewId: "addons_addons", title: "Addons › Addons", requiresEdit: true },
  { viewId: "addons_views", title: "Addons › Views", requiresEdit: true },
  { viewId: "addons_code", title: "Addons › Code", requiresEdit: true },
];

// A runtime menu item (a DropDownItem element) as a command: its name and click.
function asCommand(item, canEditGame) {
  const props = item?.props;
  if (!props || typeof props.onClick !== "function" || !props.name) return null;
  if (props.requiresEdit && !canEditGame) return null;
  return { key: String(item.key ?? props.name), name: props.name, onClick: props.onClick };
}

// The menu viewId's commands as a section, then each of its submenus as its own section
// titled by its path. `seen` keeps a menu nested in itself (A in B in A) from repeating.
function menuSections(viewId, title, getItems, canEditGame, seen) {
  if (seen.has(viewId)) return [];
  seen.add(viewId);
  const items = getItems(viewId);
  const commands = items.filter((item) => !item?.subMenu).map((item) => asCommand(item, canEditGame)).filter(Boolean);
  const sections = commands.length ? [{ key: viewId, title, items: commands }] : [];
  for (const item of items) {
    if (!item?.subMenu) continue;
    sections.push(...menuSections(item.subMenu.viewId, `${title} › ${item.subMenu.name}`, getItems, canEditGame, seen));
  }
  return sections;
}

/**
 * What addons added to the toolbar (menu items, toolbar buttons and their menus), as
 * sections of { key, title, items: [{ key, name, onClick }] }. The phone has no toolbar,
 * so its "+" sheet lists these instead.
 *
 * getItems(viewId) — menuItemsStore's items; toolbarButtons — toolbarButtonsStore's.
 */
export function addonCommandSections({ getItems, toolbarButtons, canEditGame }) {
  const seen = new Set();
  const sections = TOOLBAR_MENUS
    .filter((menu) => !menu.requiresEdit || canEditGame)
    .flatMap((menu) => menuSections(menu.viewId, menu.title, getItems, canEditGame, seen));

  const plain = toolbarButtons
    .filter((b) => !b.menuId && typeof b.onClick === "function")
    .map((b) => ({ key: b.key, name: b.name, onClick: b.onClick }));
  if (plain.length) sections.push({ key: "toolbar", title: "Toolbar", items: plain });

  for (const button of toolbarButtons.filter((b) => b.menuId)) {
    sections.push(...menuSections(button.menuId, button.name, getItems, canEditGame, seen));
  }
  return sections;
}
