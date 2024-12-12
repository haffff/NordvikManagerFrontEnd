import { fabric } from "fabric";
import UtilityHelper from "../../../../../helpers/UtilityHelper";

export class OnDragMoveClientBehavior {
  async Handle(opt, canvas, map, battleMapId) {
    if (canvas.isDragging) {
        var e = opt.e;
        var vpt = canvas.viewportTransform;
        vpt[4] += e.clientX - canvas.lastPosX;
        vpt[5] += e.clientY - canvas.lastPosY;
        canvas.requestRenderAll();
        canvas.lastPosX = e.clientX;
        canvas.lastPosY = e.clientY;
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
