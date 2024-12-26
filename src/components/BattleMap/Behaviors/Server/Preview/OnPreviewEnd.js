
export class OnPreviewEndBehavior {
  Handle(response, canvas, battleMapId) {
    if (response.data &&
      !(response.battleMapId === battleMapId)
    ) {

      const removes = response.data;

      removes.forEach(element => {
        let object = canvas.getObjects().find(x => x.previewId === element.previewId);
        canvas.remove(object);
      });
      canvas.requestRenderAll();
    }
  }
}