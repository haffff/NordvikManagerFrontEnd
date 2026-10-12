/**
 * How many turns until this player's next turn, from the turn order as they see it:
 * 0 on their turn, 1 when they're up next, and so on (wrapping into the next round).
 * Entries the player controls are marked `controlled` by the server. Null when it can't
 * be told: no token of theirs in the order, the order isn't running, or the current turn
 * is hidden from them. Hidden entries aren't sent to players, so they aren't counted.
 */
export function turnsUntilYours(state) {
  const entries = state?.entries ?? [];
  const current = entries.findIndex((entry) => entry.id === state?.currentEntryId);
  if (current < 0 || !entries.some((entry) => entry.controlled)) return null;

  for (let distance = 0; distance < entries.length; distance++) {
    if (entries[(current + distance) % entries.length].controlled) return distance;
  }
  return null;
}
