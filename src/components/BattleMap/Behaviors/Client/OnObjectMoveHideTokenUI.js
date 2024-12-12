export class OnObjectMoveHideTokenUIClientBehavior {
  Handle(event, canvas, map, battleMapId) {
    var obj = event.target;

    if (obj?.type === "activeSelection") {
      obj.forEachObject(async (subelement) => {
        if (subelement.id && subelement.additionalObjects) {
          subelement.additionalObjects?.forEach((element) => {
            if (element.visibleBeforeDrag === undefined) {
              element.set({ visibleBeforeDrag: element.visible });
              element.set({ visible: false });
            }
          });
        }

        canvas.requestRenderAll();
      });
    } else {
      if (obj.id && obj.additionalObjects) {
        obj.additionalObjects?.forEach((element) => {
          if (element.visibleBeforeDrag === undefined) {
            element.set({ visibleBeforeDrag: element.visible });
            element.set({ visible: false });

            canvas.requestRenderAll();
          }
        });
      }
    }
  }
}
