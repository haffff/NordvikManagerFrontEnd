// The token a right-click opens a read-only menu for: nothing is selected and the token
// under the pointer (canvas.lastClickTarget, from mouse down) can't be selected by this
// player, i.e. they see it but don't control it. Selecting needs Control, so without this
// such a player only ever got the empty-map menu, and never addon items for tokens.
export function inspectedToken(canvas) {
  if ((canvas?.getActiveObjects?.() ?? []).length > 0) return null;
  const target = canvas?.lastClickTarget;
  return target?.isToken && !target.selectable ? target : null;
}

export default inspectedToken;
