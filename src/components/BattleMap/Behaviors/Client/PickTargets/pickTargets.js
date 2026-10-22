// The state of picking tokens on a battle map for an action: what may be picked, what is
// picked (in order) and where the map was last clicked. Pure, so the mode is easy to test.

export const startPicking = ({ min = 1, max = 1, candidates = null, message = "", target = "token" } = {}) => ({
  target: target === "element" ? "element" : "token",
  min: Math.max(0, min),
  max: Math.max(1, max, min),
  candidates: candidates && candidates.length ? new Set(candidates) : null,
  message,
  picked: [],
  position: null,
});

export const isCandidate = (state, id) => !state.candidates || state.candidates.has(id);

// What a click can pick: a token, or with target "element" any element on the map — never
// a token's parts (bars, icons), a preview (sketch, marker) or the grid.
export function isPickable(state, object) {
  if (!object?.id || object.isTokenUI || object.preview || object.name === ".grid") return false;
  return state.target === "element" ? object.layer !== undefined || !!object.tokenData : !!object.tokenData;
}

export function togglePick(state, id) {
  if (!id || !isCandidate(state, id)) return state;
  if (state.picked.includes(id)) return { ...state, picked: state.picked.filter((x) => x !== id) };
  if (state.picked.length >= state.max) return state;
  return { ...state, picked: [...state.picked, id] };
}

export const canFinish = (state) => state.picked.length >= state.min;

export const clickAt = (state, position) => ({ ...state, position });
