import ClientMediator from "../../../../../ClientMediator";

/**
 * While an addon map tool is active (BMService.SetActionToolMode), a left click on the
 * map runs the tool's action with where and what was clicked. The tool's target decides
 * which clicks count: 'point' (anywhere), 'token' or 'element'.
 */
export class OnMouseDownActionToolClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    const tool = canvas.actionTool;
    if (!tool) return;
    if (opt.e?.button !== undefined && opt.e.button !== 0) return; // left click only

    const target = opt.target && !opt.target.isTokenUI ? opt.target : undefined;
    const kind = (tool.target || "point").toLowerCase();
    if (kind === "token" && !target?.tokenData) return;
    if (kind === "element" && !target?.id) return;

    const pointer = canvas.getPointer(opt.e);

    ClientMediator.sendCommand("Action", "Run", {
      name: tool.action,
      args: {
        ...(tool.actionArgs ?? {}),
        battleMapId,
        mapId: map?.id,
        position: { x: Math.round(pointer.x), y: Math.round(pointer.y) },
        elementId: target?.id,
      },
    });

    if (!tool.stayActive) {
      ClientMediator.sendCommand("BattleMap", "SetActionToolMode", { contextId: battleMapId, enabled: false });
    }
  }
}
