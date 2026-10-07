import { useSyncExternalStore } from "react";

// The turn order of the map on screen, as this player may see it. TurnOrderManager keeps
// it up to date; panels read it with useTurnOrder().
let state = null;
const listeners = new Set();

export const getTurnOrderState = () => state;

export function setTurnOrderState(next) {
  state = next ?? null;
  listeners.forEach((listener) => listener());
}

export function subscribeTurnOrder(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useTurnOrder = () => useSyncExternalStore(subscribeTurnOrder, getTurnOrderState);
