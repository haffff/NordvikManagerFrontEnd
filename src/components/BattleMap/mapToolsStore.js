// Addon map tools (Add Map Tool step), shown in the Tools panel under "Addon tools".
// Kept outside the panel because tools arrive whenever the server's hooks run, often
// before a Tools panel is open. Same shape as menuItemsStore.
// tool: { name, uiName, action, hint, target, stayActive, actionArgs }

let tools = [];
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener());

export const getMapTools = () => tools;

export const subscribeMapTools = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const addMapTool = (tool) => {
  if (!tool?.name) return;
  // The same tool re-sent (a reconnect, a hook running again) replaces the old one.
  tools = [...tools.filter((t) => t.name !== tool.name), tool];
  emit();
};

/** On leaving a game: the next game starts without the previous one's tools. */
export const resetMapTools = () => {
  tools = [];
  emit();
};
