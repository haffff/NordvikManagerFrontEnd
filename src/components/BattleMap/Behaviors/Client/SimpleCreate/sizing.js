// How a simple-create element takes its size from the drag (SetSimpleCreateMode's
// withSizing): "box" (rectangle, corner to corner), "radius" (circle, from its
// center) or "fontSize" (text, the dragged height). `true` is the old name for "box";
// anything else places the element at its template size where it was clicked.
export function sizingKind(withSizing) {
  if (withSizing === true) return "box";
  return withSizing === "box" || withSizing === "radius" || withSizing === "fontSize" ? withSizing : undefined;
}

export const MIN_BOX = 10;
export const MIN_RADIUS = 5;
// Below this height a text drag counts as a click: the template's font size is kept.
export const MIN_TEXT_HEIGHT = 8;
export const MIN_FONT_SIZE = 6;
