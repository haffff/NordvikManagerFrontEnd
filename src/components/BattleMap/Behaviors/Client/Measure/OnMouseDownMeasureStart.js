import { fabric } from "fabric";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../../helpers/transport";
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

      const measureType = canvas.measure.measureType ?? 'Line';

      //Create object
      fabric.util.enlivenObjects([arrow, measure], function ([arrow, measure]) {
        const commonProps = {
          previewId: UtilityHelper.GenerateUUID(),
          stayVisible: canvas.measure.dissappearAfter ? true : false,
          playerId: player.id,
        };

        if (measureType === 'Circle') {
          arrow.set({
            ...commonProps,
            left: x,
            top: y,
            radius: 0,
          });
          // Store origin so mouse:move can compute radius
          canvas.measure.originX = x;
          canvas.measure.originY = y;
        } else {
          // Line and Cone both use x1/y1/x2/y2 (LineArrow and Cone extend fabric.Line)
          arrow.set({
            ...commonProps,
            x1: x,
            y1: y,
            x2: x,
            y2: y,
          });
          if (measureType === 'Cone') {
            canvas.measure.originX = x;
            canvas.measure.originY = y;
          }
        }

        canvas.previewArrow = arrow;
        canvas.add(arrow);

        measure.set({
          ...commonProps,
          previewId: UtilityHelper.GenerateUUID(),
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
