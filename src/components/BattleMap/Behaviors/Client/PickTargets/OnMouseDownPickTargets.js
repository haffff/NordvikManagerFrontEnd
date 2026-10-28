import ClientMediator from "../../../../../ClientMediator";
import { isPickable } from "./pickTargets";

/**
 * While the player picks tokens (or elements) for an action (BMService.SetPickTargetsMode), a
 * left click toggles the one clicked and remembers where the map was clicked.
 */
export class OnMouseDownPickTargetsClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (!canvas.pickTargets) return;
    if (opt.e?.button !== undefined && opt.e.button !== 0) return; // left click only
    const target = isPickable(canvas.pickTargets.state, opt.target) ? opt.target : undefined;
    const pointer = canvas.getPointer(opt.e);
    ClientMediator.sendCommand("BattleMap", "PickTargetsClick", {
      contextId: battleMapId,
      elementId: target?.id,
      position: { x: Math.round(pointer.x), y: Math.round(pointer.y) },
    });
  }
}
