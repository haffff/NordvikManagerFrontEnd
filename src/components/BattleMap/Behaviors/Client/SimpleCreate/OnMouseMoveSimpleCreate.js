export class OnMouseMoveSimpleCreateClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (
      canvas.simpleCreateMode &&
      canvas.simpleCreateElement &&
      canvas.previewObject
    ) {
      //get client rect of battlemap
      let rect = canvas.getElement().getBoundingClientRect();
      let element = canvas.previewObject;
      if (canvas.withSizing) {
        element.set({
          width: opt.e.offsetX - element.left - rect.left,
          height: opt.e.offsetY - element.top - rect.top,
        });
      } else {
        element.set({
          left: opt.e.offsetX,
          top: opt.e.offsetY,
        });
      }
      canvas.requestRenderAll();
    }
  }
}
