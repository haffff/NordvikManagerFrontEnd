// Menu items added at runtime (addon AddMenuItem steps, submenus "created on the
// way"), per menu viewId. Kept here rather than in the menu components, because
// they arrive whenever the server's hooks run — often before the menu they belong
// to is mounted (the battle map's "Add" submenu only exists with a battle map open
// and the map permissions loaded). A DropDownMenu shows whatever is here for its
// viewId, whenever it mounts.

let itemsByView = new Map(); // viewId → (React element | submenu description)[]
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener());

const EMPTY = Object.freeze([]);

export const getMenuItems = (viewId) => itemsByView.get(viewId) ?? EMPTY;

export const subscribeMenuItems = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const append = (viewId, element) => {
  const current = getMenuItems(viewId);
  // The same item re-sent (a reconnect, a hook running again) carries the same key.
  if (element?.key != null && current.some((el) => el.key === element.key)) return;
  itemsByView = new Map(itemsByView).set(viewId, [...current, element]);
  emit();
};

export const addMenuItem = (viewId, element) => append(viewId, element);

/**
 * Adds a submenu (itself a menu with viewId subMenuId) to the menu parentViewId.
 * Stored as a description, { key, subMenu: { viewId, name } }; DropDownMenu renders it.
 */
export const addSubMenu = (parentViewId, subMenuId, subMenuName) => {
  // An item in a submenu may name that submenu as both its location and its
  // SubMenuId (dnd5e's "Card Settings" does): that's "put it in there", not
  // "nest the menu in itself", which would render without end.
  if (parentViewId === subMenuId) return;
  append(parentViewId, { key: subMenuId, subMenu: { viewId: subMenuId, name: subMenuName || subMenuId } });
};

// What a context menu was opened on (e.g. { elementId } for a token's right-click menu),
// per viewId. The menu sets it when it opens; an addon item's click passes it to its
// action as variables (useGameEventHandlers.HandleAddMenuItem).
let contextByView = new Map();

export const setMenuContext = (viewId, context) => {
  contextByView.set(viewId, context ?? {});
};

export const getMenuContext = (viewId) => contextByView.get(viewId) ?? {};

/** On leaving a game: the next game starts without the previous one's items. */
export const resetMenuItems = () => {
  itemsByView = new Map();
  contextByView = new Map();
  emit();
};
