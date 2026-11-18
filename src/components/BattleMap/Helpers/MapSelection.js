import { fabric } from "fabric";
import { isLayerHidden } from "./LayerTargeting";

// Selecting on the map, on top of what Fabric does by itself (a plain click selects one
// element, a plain drag on the empty map selects an area instead of the selection):
//
// - Ctrl, Cmd or Shift + click adds an element to the selection or takes it out.
// - The same keys + drag from the empty map adds the area to the selection.
//
// A press on an element's handle stays a resize, so Shift (keep the proportions) and the
// snap keys work as before. A drag on an element with one of the keys held stays a move (the
// key may be the move snap key): only a press and release without moving adds or takes out.
const SELECTION_KEYS = ["ctrlKey", "metaKey", "shiftKey"];

function select(canvas, objects, e) {
  // Objects can't be in two selections: their coordinates are relative to the old one.
  canvas.discardActiveObject(e);
  if (objects.length === 1) {
    canvas.setActiveObject(objects[0], e);
  } else if (objects.length > 1) {
    canvas.setActiveObject(new fabric.ActiveSelection(objects, { canvas }), e);
  }
}

// In drawing order, as Fabric's own area selection keeps them.
const inStackOrder = (canvas, objects) => {
  const wanted = new Set(objects);
  return canvas.getObjects().filter((obj) => wanted.has(obj));
};

export function installMapSelection(canvas) {
  if (!canvas || canvas.__mapSelection) return;

  canvas.selectionKey = SELECTION_KEYS;

  // Fabric adds or takes out at the press, and then doesn't move anything. Here the press
  // moves as without the key (the element, or the whole selection when pressed inside it),
  // and the release adds or takes out if nothing moved.
  const shouldGroup = canvas._shouldGroup;
  canvas._shouldGroup = function (e, target) {
    this.__pendingToggle = null;
    if (!shouldGroup.call(this, e, target)) return false;
    const active = this._activeObject;
    // On a handle Fabric groups nothing either (_handleGrouping): its way.
    if (active.__corner) return true;
    const toggled = target === active ? this.findTarget(e, true) : target;
    if (!toggled || !toggled.selectable) return true;
    this.__pendingToggle = { target: toggled, before: this.getActiveObjects() };
    return false;
  };
  canvas.on("mouse:up", (opt) => {
    const pending = canvas.__pendingToggle;
    canvas.__pendingToggle = null;
    if (!pending || opt.transform?.actionPerformed) return;
    const { target, before } = pending;
    const objects = before.includes(target) ? before.filter((obj) => obj !== target) : [...before, target];
    select(canvas, inStackOrder(canvas, objects), opt.e);
    canvas.requestRenderAll();
  });

  const shouldClearSelection = canvas._shouldClearSelection;
  canvas._shouldClearSelection = function (e, target) {
    // Decided here, at the press: letting go of the key before the mouse changes nothing.
    this.__areaAddsToSelection = (!target || !target.selectable) && !!this._isSelectionKeyPressed(e);
    return !this.__areaAddsToSelection && shouldClearSelection.call(this, e, target);
  };

  const groupSelectedObjects = canvas._groupSelectedObjects;
  canvas._groupSelectedObjects = function (e) {
    const kept = this.__areaAddsToSelection ? this.getActiveObjects() : [];
    if (!kept.length) return groupSelectedObjects.call(this, e);

    const inArea = this._collectObjects(e);
    if (inArea.every((obj) => kept.includes(obj))) return undefined;
    return select(this, inStackOrder(this, [...kept, ...inArea]), e);
  };

  canvas.__mapSelection = true;
}

/** Selects every element this player can select on the layer being worked on. */
export function selectAll(canvas) {
  // Switched off while a tool (measuring, drawing, panning...) has the mouse.
  if (!canvas?.selection || canvas.isDrawingMode || canvas.editGridMode) return;

  const objects = canvas.getObjects().filter(
    (obj) => obj.selectable && obj.visible && obj.evented && !obj.isTokenUI && !isLayerHidden(canvas, obj)
  );
  if (!objects.length) return;

  select(canvas, objects);
  canvas.requestRenderAll();
}

export default installMapSelection;
