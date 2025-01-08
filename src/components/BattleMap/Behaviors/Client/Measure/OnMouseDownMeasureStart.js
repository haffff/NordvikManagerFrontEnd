import { fabric } from "fabric";
import WebSocketManagerInstance from "../../../../game/WebSocketManager";
import DTOConverter from "../../../DTOConverter";
import UtilityHelper from "../../../../../helpers/UtilityHelper";
import ClientMediator from "../../../../../ClientMediator";

export class OnMouseDownMeasureStartClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.measureMode && canvas.measure) {
      //Get create element
      let arrow = canvas.measure.measureArrow;
      let measure = canvas.measure.measureObject;

      //get client rect of battlemap
      let { x, y } = canvas.getPointerWithAlign(opt);

      //get current player
      let player = ClientMediator.sendCommand("Game", "GetCurrentPlayer");

      //Create object
      fabric.util.enlivenObjects([arrow, measure], function ([arrow, measure]) {
        arrow.set({
          x1: x,
          y1: y,
          x2: x,
          y2: y,
          previewId: UtilityHelper.GenerateUUID(),
          stayVisible: canvas.measure.dissappearAfter ? true : false,
          playerId: player.id,
        });
        canvas.previewArrow = arrow;
        canvas.add(arrow);

        measure.set({
          previewId: UtilityHelper.GenerateUUID(),
          stayVisible: canvas.measure.dissappearAfter ? true : false,
          playerId: player.id,
          top: y + 10,
          left: x + 10,
        });

        canvas.previewMeasure = measure;
        canvas.add(measure);

        if (canvas.measure.visibleToOthers === true) {
          WebSocketManagerInstance.Send({
            command: "preview_start",
            battleMapId: battleMapId,
            data: [arrow, measure],
          });
        }
        canvas.requestRenderAll();
      });
    }
  }
}
