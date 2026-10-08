// Clicks go to the layer being worked on (canvas.selectedLayer). Fabric itself gives
// a click to the topmost element under the pointer that's `evented`, whatever its
// layer — so an element on a layer above the token layer took clicks meant for a
// token under it, without selecting anything (it isn't selectable there).
//
// Hooks Fabric's per-element hit test, so it follows layer switches without having
// to keep an `evented` flag in step on every element.

import { RESERVED_LAYERS } from "../Constants/layers";

// Token UI (bars, name tags, the "open card" button) is drawn on its own layer,
// above every token, but is clicked as part of the token layer.
const clickLayer = (obj) =>
  obj.isTokenUI || obj.layer === RESERVED_LAYERS.TOKEN_UI ? RESERVED_LAYERS.TOKEN : obj.layer;

export function installLayerTargeting(canvas) {
  if (!canvas || canvas.__layerTargeting) return;
  const checkTarget = canvas._checkTarget;
  canvas._checkTarget = function (pointer, obj, globalPointer) {
    if (
      obj &&
      obj.layer !== undefined &&
      clickLayer(obj) !== this.selectedLayer &&
      !obj.selectable &&
      // Fabric also tests the active object first (e.g. the grid during Edit Grid).
      obj !== this._activeObject
    ) {
      return false;
    }
    return checkTarget.call(this, pointer, obj, globalPointer);
  };
  canvas.__layerTargeting = true;
}

export default installLayerTargeting;
