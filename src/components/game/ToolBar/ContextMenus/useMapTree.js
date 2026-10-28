import * as React from "react";
import { ActiveWebHelper as WebHelper, ActiveTransportManager } from "../../../../helpers/transport";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import { buildTree } from "../../../uiComponents/tree/treeModel";

const ENTRY_TYPE = "MapModel";

/**
 * The maps' folder tree entries (the Map Selector's folders), kept current; null until loaded.
 * Moves and new folders reload it, the same events DTreeList listens to.
 */
export function useMapTree() {
  const [entries, setEntries] = React.useState(null);

  const load = React.useCallback(() => {
    WebHelper.get(
      `battlemap/getTree?entityType=${ENTRY_TYPE}`,
      (r) => setEntries(Array.isArray(r) ? r : []),
      () => {},
    );
  }, []);

  React.useEffect(() => {
    load();
    const key = `mapTree${UtilityHelper.GenerateUUID()}`;
    ActiveTransportManager.Subscribe(key, ({ command, result, data }) => {
      if (result && result !== "Ok") return;
      if (command === "tree_add" || command === "tree_update") {
        const incoming = (Array.isArray(data) ? data : [data]).filter(Boolean);
        if (incoming.some((x) => x.entryType === ENTRY_TYPE)) load();
      } else if (command === "tree_remove") {
        setEntries((prev) => (prev?.some((x) => x.id === data) ? prev.filter((x) => x.id !== data) : prev));
      }
    });
    return () => ActiveTransportManager.Unsubscribe(key);
  }, [load]);

  return entries;
}

/**
 * The Switch Map menu's nodes: folders that hold maps (at any depth) and the maps, in tree
 * order. Maps the tree doesn't list yet go at the end, so none goes missing.
 */
export function mapMenuNodes(entries, maps) {
  const prune = (nodes) => nodes
    .map((n) => (n.isFolder ? { ...n, children: prune(n.children) } : n))
    .filter((n) => !n.isFolder || n.children.length > 0);

  const nodes = entries?.length ? prune(buildTree(entries, maps)) : [];

  const shown = new Set();
  const collect = (list) => list.forEach((n) => (n.isFolder ? collect(n.children) : shown.add(n.entity.id)));
  collect(nodes);

  const rest = (maps ?? [])
    .filter((m) => !shown.has(m.id))
    .map((m) => ({ id: m.id, isFolder: false, name: m.name ?? "", entity: m, children: [] }));

  return [...nodes, ...rest];
}
