export class OnMouseUpSimpleCreateClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (
      canvas.simpleCreateMode &&
      canvas.simpleCreateElement &&
      canvas.previewObject
    ) {
      let element = canvas.previewObject;
      canvas.remove(element);
      canvas.previewObject = null;
      canvas.requestRenderAll();
    }
  }
}
