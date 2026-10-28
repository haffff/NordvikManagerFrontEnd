import { MIN_FONT_SIZE, MIN_TEXT_HEIGHT, sizingKind } from "./sizing";

export class OnMouseMoveSimpleCreateClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (
      canvas.simpleCreateMode &&
      canvas.simpleCreateElement &&
      canvas.previewObject
    ) {
      //get client rect of battlemap
      let canvasCoords = canvas.getPointerWithAlign(opt);

      let element = canvas.previewObject;
      // Use the anchor captured at mouse:down so left/top are stable as the user drags.
      const anchorX = canvas.previewAnchorX;
      const anchorY = canvas.previewAnchorY;
      const rawW = canvasCoords.x - anchorX;
      const rawH = canvasCoords.y - anchorY;

      switch (sizingKind(canvas.withSizing)) {
        case "box":
          // Handle dragging up/left by flipping origin when the raw delta is negative.
          element.set({
            left:   rawW >= 0 ? anchorX : canvasCoords.x,
            top:    rawH >= 0 ? anchorY : canvasCoords.y,
            width:  Math.abs(rawW),
            height: Math.abs(rawH),
          });
          break;
        case "radius":
          element.set({ radius: Math.sqrt(rawW * rawW + rawH * rawH) });
          break;
        case "fontSize": {
          // A drag shorter than a click's wobble keeps the template's size.
          if (Math.abs(rawH) < MIN_TEXT_HEIGHT) {
            element.set({ left: anchorX, top: anchorY, fontSize: canvas.simpleCreateElement.fontSize });
            break;
          }
          const lineHeight = element.lineHeight || 1.16;
          element.set({
            left: anchorX,
            top: rawH >= 0 ? anchorY : canvasCoords.y,
            fontSize: Math.max(MIN_FONT_SIZE, Math.round(Math.abs(rawH) / lineHeight)),
          });
          break;
        }
        default:
          element.set({
            left: canvasCoords.x,
            top: canvasCoords.y
          });
      }
      canvas.requestRenderAll();
    }
  }
}
