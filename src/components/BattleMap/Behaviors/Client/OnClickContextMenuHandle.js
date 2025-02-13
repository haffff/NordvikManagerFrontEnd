import ClientMediator from "../../../../ClientMediator";

//ToDelete

export class OnClickContextMenuHandleClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.contextMenuLock) {
      return;
    }
  }
}
