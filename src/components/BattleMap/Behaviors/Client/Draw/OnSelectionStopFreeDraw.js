import ClientMediator from "../../../../../ClientMediator";

/**
 * Drawing (Paint or Sketch) and a selected element don't mix: fabric's drawing mode
 * only stops selecting by mouse, but elements are still selected from elsewhere
 * (turn order, tree, objects list). Selecting one ends drawing, keeping the selection.
 */
export class OnSelectionStopFreeDrawClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (!canvas.freeDrawMode) return;

    ClientMediator.sendCommand("BattleMap", "SetFreeDrawMode", { contextId: battleMapId, enabled: false });
  }
}
