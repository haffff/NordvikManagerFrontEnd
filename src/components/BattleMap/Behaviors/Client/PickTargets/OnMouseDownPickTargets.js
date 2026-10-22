import ClientMediator from "../../../../../ClientMediator";

/**
 * While the player picks tokens for an action (BMService.SetPickTargetsMode), a left click
 * toggles the token clicked and remembers where the map was clicked.
 */
export class OnMouseDownPickTargetsClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (!canvas.pickTargets) return;
    if (opt.e?.button !== undefined && opt.e.button !== 0) return; // left click only
    const target = opt.target && !opt.target.isTokenUI && opt.target.tokenData ? opt.target : undefined;
    const pointer = canvas.getPointer(opt.e);
    ClientMediator.sendCommand("BattleMap", "PickTargetsClick", {
      contextId: battleMapId,
      elementId: target?.id,
      position: { x: Math.round(pointer.x), y: Math.round(pointer.y) },
    });
  }
}
