// The variables addon menu items on the battle map hand to their action: the view, the map
// it shows and where it was clicked; on an element, that element and every selected one.
export function battleMapMenuContexts({ battleMapId, mapId, position, selected }) {
  const where = { battleMapId, mapId, position };
  const ids = (selected ?? []).map((o) => o?.id).filter(Boolean);
  return {
    battlemap: where,
    battlemap_add: where,
    battlemap_element: { ...where, elementId: ids[0], elementIds: ids },
  };
}
