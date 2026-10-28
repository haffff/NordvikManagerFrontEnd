import * as React from "react";
import ClientMediator from "../../../ClientMediator";

// Which folders are open in a tree, remembered per game and tree type in this browser
// (e.g. "nm.tree.open.<gameId>.ResourceModel"), so reopening a panel keeps its folders open.

const storageKey = (entityType) => {
  let gameId = "";
  try { gameId = ClientMediator.sendCommand("Game", "GetGameId") ?? ""; } catch { /* not in a game */ }
  return `nm.tree.open.${gameId}.${entityType}`;
};

const read = (key) => {
  try {
    const ids = JSON.parse(localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(ids) ? ids : []);
  } catch { return new Set(); }
};

const write = (key, set) => {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* storage unavailable */ }
};

/**
 * @returns [openIds: Set, setOpen(id, open), pruneTo(existingIds: Set)]
 */
export function useRememberedOpenFolders(entityType) {
  const key = React.useMemo(() => storageKey(entityType ?? "tree"), [entityType]);
  const [openIds, setOpenIds] = React.useState(() => read(key));

  React.useEffect(() => { setOpenIds(read(key)); }, [key]);

  const setOpen = React.useCallback((id, open) => {
    setOpenIds((prev) => {
      if (prev.has(id) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(id); else next.delete(id);
      write(key, next);
      return next;
    });
  }, [key]);

  // Forget folders that no longer exist, so the stored list doesn't grow forever.
  const pruneTo = React.useCallback((existingIds) => {
    setOpenIds((prev) => {
      const next = new Set([...prev].filter((id) => existingIds.has(id)));
      if (next.size === prev.size) return prev;
      write(key, next);
      return next;
    });
  }, [key]);

  return [openIds, setOpen, pruneTo];
}

export default useRememberedOpenFolders;
