import { fabric } from "fabric";
import UtilityHelper from "../../../../../helpers/UtilityHelper";

export class OnDragEndClientBehavior {
  async Handle(opt, canvas, map, battleMapId) {
    // on mouse up we want to recalculate new interaction
    // for all objects, so we call setViewportTransform
    if (canvas.isDragging) {
      canvas.setViewportTransform(canvas.viewportTransform);
      canvas.isDragging = false;
      canvas.selection = true;
    }

    var obj = opt.target;

    if (obj?.type === "activeSelection") {
      obj.forEachObject(async (subelement) => {
        if (subelement.id && subelement.additionalObjects) {
          subelement.additionalObjects?.forEach((element) => {
            if (element.visibleBeforeDrag !== undefined) {
              element.set({ visible: element.visibleBeforeDrag });
              element.set({ visibleBeforeDrag: undefined });
            }
          });
        }

        canvas.requestRenderAll();
      });
    } else {
      if (obj?.id && obj.additionalObjects) {
        obj.additionalObjects?.forEach((element) => {
          if (element.visibleBeforeDrag !== undefined) {
            element.set({ visible: element.visibleBeforeDrag });
            element.set({ visibleBeforeDrag: undefined });
          }
        });
      }
      canvas.requestRenderAll();
    }

    if (canvas.isDisplaying) {
      canvas.isDisplaying = false;
      let canvasCoords = canvas.getPointer(opt);
      //if (references.argumentsRef.current.onEnd) {
      //  references.argumentsRef.current.onEnd(canvasCoords, canvas);
      //}
      canvas.requestRenderAll();
    }
  }
}
