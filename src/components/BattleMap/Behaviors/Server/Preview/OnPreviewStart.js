import { fabric } from "fabric";
import ClientMediator from "../../../../../ClientMediator";

export class OnPreviewStartBehavior {
  Handle(response, canvas, battleMapId) {
    if (response.data && !(response.battleMapId === battleMapId)) {
      const objects = response.data;
      fabric.util.enlivenObjects(objects, (elements) => {
        elements.forEach((element, i) => {
          let previewId = objects[i].previewId;
          element.set({
            selectable: false,
            previewId: previewId,
            preview: true,
          });
          canvas.add(element);
        });
        canvas.requestRenderAll();
      });
    }
  }
}
