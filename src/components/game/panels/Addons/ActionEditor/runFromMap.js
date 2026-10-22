// "Run from map" in the action editor: the variables a map tool or menu click hands an
// action, from what the player picked and clicked on the map.
export function runFromMapArgs(state, where) {
  const args = { battleMapId: where.battleMapId, mapId: where.mapId, elementIds: [...state.picked] };
  if (state.position) args.position = state.position;
  if (state.picked.length > 0) args.elementId = state.picked[0];
  return args;
}
