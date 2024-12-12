import ClientMediator from "../../../../ClientMediator";

export class OnClickContextMenuHandleClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.contextMenuLock) {
      return;
    }

    if (opt.button === 3) {
        ClientMediator.sendCommand("Battlemap", "ShowContextMenu", { contextId: battleMapId, x: opt.e.clientX, y: opt.e.clientY });
    }

    if(opt.button === 1 && canvas.isContextMenuVisible)
    {
        ClientMediator.sendCommand("Battlemap", "HideContextMenu", { contextId: battleMapId });
    }
  }
}
