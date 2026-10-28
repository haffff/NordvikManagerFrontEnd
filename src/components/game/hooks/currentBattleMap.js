// The battle map view the player is looking at — the selected one, else the first open —
// and the map it shows. Without waiting: undefined when no view is open.
export function currentBattleMap(selectedId, openContexts, mapIdOf) {
  const battleMapId = selectedId ?? Object.values(openContexts ?? {})[0]?.id;
  if (!battleMapId) return undefined;
  return { battleMapId, mapId: mapIdOf(battleMapId) };
}
