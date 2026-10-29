// The open tabs of the mobile game UI: what the dock's floating panels are on desktop.
// A plain external store (like menuItemsStore) so non-React code — DockableHelper.NewFloating,
// the show_* handlers — can open tabs, and MobileShell reads it with useSyncExternalStore.
import { LayoutHelper } from "../../../helpers/LayoutCloneHelper";
import { stableJson } from "../../../helpers/showToPlayers";
import UtilityHelper from "../../../helpers/UtilityHelper";

const EMPTY = Object.freeze({ tabs: Object.freeze([]), activeId: null });

let snapshot = EMPTY;
const listeners = new Set();

const commit = (next) => {
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
};

export const getTabsSnapshot = () => snapshot;

export const subscribeTabs = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// What makes two panels "the same tab", as findOpenPanel decides it for the dock: a battle
// map by its sync id, anything else by its type and its saveable props.
const identityOf = (panelKey, props) =>
  panelKey === "Battlemap"
    ? `Battlemap:${props?.withID ?? props?.syncId ?? ""}`
    : `${panelKey}:${stableJson(LayoutHelper.SerializableProps(props))}`;

/**
 * Opens `element` as a tab and makes it active; if the same panel is already open, switches
 * to that one. Returns the tab id (also the panel's dock content id, e.g. a battle map's
 * PanelContentID).
 */
export function openTab(element, resolveKey = LayoutHelper._resolvePanelKey) {
  const panelKey = resolveKey(element?.type) ?? "Panel";
  const identity = identityOf(panelKey, element?.props);
  const existing = snapshot.tabs.find((tab) => tab.identity === identity);
  if (existing) {
    activateTab(existing.id);
    return existing.id;
  }
  const id = UtilityHelper.GenerateUUID();
  commit({ tabs: [...snapshot.tabs, { id, panelKey, identity, element, title: null }], activeId: id });
  return id;
}

export function activateTab(id) {
  if (id === snapshot.activeId || !snapshot.tabs.some((tab) => tab.id === id)) return;
  commit({ ...snapshot, activeId: id });
}

export function closeTab(id) {
  const index = snapshot.tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return;
  const tabs = snapshot.tabs.filter((tab) => tab.id !== id);
  let activeId = snapshot.activeId;
  if (activeId === id) {
    // The one that slides into its place, else the one before it.
    activeId = (tabs[index] ?? tabs[index - 1])?.id ?? null;
  }
  commit({ tabs, activeId });
}

// Panels call setTitle on render and in effects: only a real change notifies.
export function setTabTitle(id, title) {
  const tab = snapshot.tabs.find((t) => t.id === id);
  if (!tab || tab.title === title) return;
  commit({ ...snapshot, tabs: snapshot.tabs.map((t) => (t.id === id ? { ...t, title } : t)) });
}

export function resetTabs() {
  commit(EMPTY);
}
