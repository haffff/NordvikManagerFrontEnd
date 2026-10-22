import { drawLayerOf } from "./layerVisibility";

// Two per-canvas rules on top of Fabric's own drawing and hit testing:
//
// 1. Clicks go to the layer being worked on (canvas.selectedLayer). Fabric itself
//    gives a click to the topmost element under the pointer that's `evented`,
//    whatever its layer — so an element on a layer above the token layer took
//    clicks meant for a token under it, without selecting anything (it isn't
//    selectable there).
// 2. The layer view (setLayerView, from layerVisibility.layerView): elements on
//    hidden layers aren't drawn, clicked or rectangle-selected; elements on dimmed
//    (GM-only, for the GM) layers are drawn faded.
//
// Hooks Fabric's drawing and hit tests, so both follow layer switches and flag
// changes without keeping `evented`/`visible`/`opacity` in step on every element.

const DIMMED_ALPHA = 0.45;

const isHidden = (canvas, obj) => !!canvas.layerView?.hidden.has(drawLayerOf(obj));

// An element whose size or place isn't a finite number gets a 0x0 cache canvas, and
// Fabric's drawImage then throws in the middle of drawing the map — which leaves
// trails of everything moved afterwards. Such an element isn't drawn, and is named
// in the console once.
const GEOMETRY = ["width", "height", "scaleX", "scaleY", "left", "top"];
const reported = new WeakSet();
function canDraw(obj) {
  const bad = GEOMETRY.filter((k) => obj[k] !== undefined && !Number.isFinite(obj[k]));
  if (!bad.length) return true;
  if (!reported.has(obj)) {
    reported.add(obj);
    console.warn("Battle map: not drawing an element with an unusable size or place", {
      id: obj.id, name: obj.name, type: obj.type, ...Object.fromEntries(bad.map((k) => [k, obj[k]])),
    });
  }
  return false;
}

export function installLayerTargeting(canvas) {
  if (!canvas || canvas.__layerTargeting) return;

  const checkTarget = canvas._checkTarget;
  canvas._checkTarget = function (pointer, obj, globalPointer) {
    if (obj && obj.layer !== undefined && isHidden(this, obj)) return false;
    if (
      obj &&
      // Picking for an action (RequestTargets): the element may be on any layer.
      !this.pickTargets &&
      obj.layer !== undefined &&
      drawLayerOf(obj) !== this.selectedLayer &&
      !obj.selectable &&
      // Fabric also tests the active object first (e.g. the grid during Edit Grid).
      obj !== this._activeObject
    ) {
      return false;
    }
    return checkTarget.call(this, pointer, obj, globalPointer);
  };

  canvas._renderObjects = function (ctx, objects) {
    const view = this.layerView;
    for (const obj of objects) {
      if (!obj || !canDraw(obj)) continue;
      const layer = view ? drawLayerOf(obj) : undefined;
      if (view?.hidden.has(layer)) continue;
      if (view?.dimmed.has(layer)) {
        ctx.save();
        ctx.globalAlpha *= DIMMED_ALPHA;
        obj.render(ctx);
        ctx.restore();
      } else {
        obj.render(ctx);
      }
    }
  };

  const collectObjects = canvas._collectObjects;
  canvas._collectObjects = function (e) {
    const collected = collectObjects.call(this, e) ?? [];
    return this.layerView ? collected.filter((obj) => !isHidden(this, obj)) : collected;
  };

  canvas.__layerTargeting = true;
}

/** Sets which layers this canvas leaves out and fades: { hidden: Set, dimmed: Set } of layerIds. */
export function setLayerView(canvas, view) {
  if (!canvas) return;
  canvas.layerView = view;
  // A selection can't stay on something that's no longer drawn.
  if ((canvas.getActiveObjects?.() ?? []).some((obj) => isHidden(canvas, obj))) {
    canvas.discardActiveObject();
  }
  canvas.requestRenderAll?.();
}

export default installLayerTargeting;
