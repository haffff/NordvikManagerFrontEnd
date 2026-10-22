import ClientMediator from "../../../../../ClientMediator";

// While the player points at a place for an action (BMService.SetPickPointMode): the marker
// follows the pointer, and a left click chooses the place.

const at = (opt, canvas) => {
  const pointer = canvas.getPointer(opt.e);
  return { x: pointer.x, y: pointer.y };
};

export class OnMouseMovePickPointClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (!canvas.pickPoint) return;
    ClientMediator.sendCommand("BattleMap", "PickPointMove", { contextId: battleMapId, position: at(opt, canvas) });
  }
}

export class OnMouseDownPickPointClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (!canvas.pickPoint) return;
    if (opt.e?.button !== undefined && opt.e.button !== 0) return; // left click only
    ClientMediator.sendCommand("BattleMap", "PickPointClick", { contextId: battleMapId, position: at(opt, canvas) });
  }
}
