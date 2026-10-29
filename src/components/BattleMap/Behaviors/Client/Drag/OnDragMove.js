import { fabric } from "fabric";
import UtilityHelper from "../../../../../helpers/UtilityHelper";
import { touchPoint } from "../../../Helpers/touchGestures";

export class OnDragMoveClientBehavior {
  async Handle(opt, canvas, map, battleMapId) {
    if (canvas.isDragging) {
        // A mouse event, or a touch event (its point is on its touch).
        const point = touchPoint(opt.e);
        var vpt = canvas.viewportTransform;
        vpt[4] += point.x - canvas.lastPosX;
        vpt[5] += point.y - canvas.lastPosY;
        canvas.requestRenderAll();
        canvas.lastPosX = point.x;
        canvas.lastPosY = point.y;
      }
  
    //   if (references.popupVisibleRef && references.popupVisibleRef.current) {
    //     const rect =
    //       references.battleMapContainerRef.current.getBoundingClientRect();
    //     references.popupRef.current.style.left = `${opt.e.clientX - rect.x}px`;
    //     references.popupRef.current.style.top = `${opt.e.clientY - rect.y}px`;
    //     references.popupRef.current.style.display = "block";
    //   } else {
    //     references.popupRef.current.style.display = "none";
    //   }
  }
}
