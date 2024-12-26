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
        element.set({
            width: canvasCoords.x - element.left,
            height: canvasCoords.y - element.top,
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
