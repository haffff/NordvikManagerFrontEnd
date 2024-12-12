import { fabric } from "fabric";
import UtilityHelper from "../../../../../helpers/UtilityHelper";
import ClientMediator from "../../../../../ClientMediator";

export class OnDragStartClientBehavior {
  async Handle(opt, canvas, map, battleMapId) {

    ClientMediator.fireEvent("ActivePanelChanged", {
      panel: "BattleMap",
      contextId: battleMapId,
    });

    canvas.lastAbsolutePointer = canvas.getPointer(opt.e);

    var evt = opt.e;
    if(opt.button === 2 || canvas.draggingMode)
    {
        canvas.isDragging = true;
        canvas.selection = false;
        canvas.lastPosX = evt.clientX;
        canvas.lastPosY = evt.clientY;
        return;
    }

    // if (opt.button === 3) {
    //   references.contextMenuVisibleRef.current = true;
    //   const rect =
    //     references.battleMapContainerRef.current.getBoundingClientRect();

    //   references.contextMenuRef.current.style.left = `${
    //     opt.e.clientX - rect.x
    //   }px`;
    //   references.contextMenuRef.current.style.top = `${
    //     opt.e.clientY - rect.y
    //   }px`;
    //   references.contextMenuRef.current.style.display = "block";
    // } else {
    //   references.contextMenuVisibleRef.current = false;
    //   references.contextMenuRef.current.style.display = "none";
    // }


    //switch (references.operationRef.current) {
    //   case BattleMapModes.DRAG:
    //     canvas.isDragging = true;
    //     canvas.selection = false;
    //     canvas.lastPosX = evt.clientX;
    //     canvas.lastPosY = evt.clientY;
    //     break;
    //   case BattleMapModes.SELECT:
    //     canvas.isDragging = false;
    //     canvas.selection = true;
    //     break;
    //   case BattleMapModes.DISPLAY:
    //     canvas.selection = false;
    //     let canvasCoords = canvas.getPointer(opt);
    //     //if (references.argumentsRef.current.onStart) {
    //     //  references.argumentsRef.current.onStart(canvasCoords, canvas);
    //     //}
    //     canvas.isDisplaying = true;
    //     break;
    //   default:
    //     break;
    //}
  }
}
