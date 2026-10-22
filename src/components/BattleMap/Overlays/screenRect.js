import { fabric } from "fabric";

/**
 * An object's bounding box on screen (relative to Fabric's wrapper div), also while
 * it is in a multi-selection: Fabric then keeps the object's own left/top relative to
 * the selection's centre, which getBoundingRect(false, true) alone doesn't account for.
 */
export function screenRect(obj) {
  if (!obj.group) return obj.getBoundingRect(false, true);
  const vpt = obj.canvas?.viewportTransform ?? obj.group.canvas?.viewportTransform ?? fabric.iMatrix;
  const matrix = fabric.util.multiplyTransformMatrices(vpt, obj.calcTransformMatrix());
  const dim = obj._getNonTransformedDimensions();
  const w = dim.x / 2;
  const h = dim.y / 2;
  const corners = [
    { x: -w, y: -h },
    { x: w, y: -h },
    { x: w, y: h },
    { x: -w, y: h },
  ].map((p) => fabric.util.transformPoint(p, matrix));
  return fabric.util.makeBoundingBoxFromPoints(corners);
}

export default screenRect;
