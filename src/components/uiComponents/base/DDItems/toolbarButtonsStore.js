import * as React from "react";
import ClientMediator from "../../../../ClientMediator";

// Toolbar buttons added at runtime (addon Add Toolbar Button steps, addons calling the
// "Toolbar" AddButton command). Kept outside the toolbar, like menuItemsStore, because
// the phone UI has no toolbar: its "+" sheet shows them instead.
//
// A button is { key, name, onClick } or, for a menu button, { key, name, menuId, menuName }
// whose items are menuItemsStore's items for menuId.

let buttons = [];
const listeners = new Set();

export const getToolbarButtons = () => buttons;

export const subscribeToolbarButtons = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const addToolbarButton = ({ name, onClick, menuId, menuName }) => {
  const key = menuId || name;
  // The same button re-sent (a reconnect, a hook running again).
  if (buttons.some((b) => b.key === key)) return;
  buttons = [...buttons, { key, name: menuId ? (menuName || name || menuId) : name, onClick, menuId, menuName }];
  listeners.forEach((listener) => listener());
};

/** On leaving a game: the next game starts without the previous one's buttons. */
export const resetToolbarButtons = () => {
  buttons = [];
  listeners.forEach((listener) => listener());
};

/**
 * Registers the "Toolbar" commands addons send through the ClientMediator (AddButton:
 * { name, onClick } or { name, menuId, menuName }). Used by whichever toolbar is showing:
 * the desktop one, or the phone's "+" sheet.
 */
export function useToolbarCommands(id) {
  React.useEffect(() => {
    ClientMediator.register({
      panel: "Toolbar",
      id,
      AddButton: (buttonData) => addToolbarButton(buttonData ?? {}),
    });
    return () => ClientMediator.unregister(id);
  }, [id]);
}
