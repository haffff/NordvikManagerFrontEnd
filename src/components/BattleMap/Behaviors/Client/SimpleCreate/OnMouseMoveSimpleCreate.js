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
      if (canvas.withSizing) {
        // Use the anchor captured at mouse:down so left/top are stable as the user drags.
        // Handle dragging up/left by flipping origin when the raw delta is negative.
        const anchorX = canvas.previewAnchorX;
        const anchorY = canvas.previewAnchorY;
        const rawW = canvasCoords.x - anchorX;
        const rawH = canvasCoords.y - anchorY;
        element.set({
          left:   rawW >= 0 ? anchorX : canvasCoords.x,
          top:    rawH >= 0 ? anchorY : canvasCoords.y,
          width:  Math.abs(rawW),
          height: Math.abs(rawH),
        });
      } else {
        element.set({
            left: canvasCoords.x,
            top: canvasCoords.y
        });
      }
      canvas.requestRenderAll();
    }
  }
}
