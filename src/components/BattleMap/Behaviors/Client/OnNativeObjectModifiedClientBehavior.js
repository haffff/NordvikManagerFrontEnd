import ClientMediator from "../../../../ClientMediator";
import WebSocketManagerInstance from "../../../game/WebSocketManager";
import DTOConverter from "../../DTOConverter";
import CommandFactory from "../../Factories/CommandFactory";
import { fabric } from "fabric";

export class OnNativeObjectModifiedClientBehavior {
  Handle(event, canvas, map, battleMapId) {
    var renderGrid = map.gridVisible;

    //align to grid when exists and no alt is pressed
    if (renderGrid && canvas.alignMode !== "none" && !event.transform.altKey) {

      var gridSize = map.gridSize;

      let x = Math.round(event.target.left / gridSize) * gridSize;
      let y = Math.round(event.target.top / gridSize) * gridSize;

      if(canvas.alignMode === "center")
      {
        x += gridSize / 2;
        y += gridSize / 2;
      }

      event.target.set({
        left: x,
        top: y,
      });
    }

    if (event.target.type === "activeSelection") {
      event.target.forEachObject(async (subelement) => {
        if (subelement.id && subelement.additionalObjects) {
          await ClientMediator.sendCommandAsync(
            "BattleMap_Token",
            "UpdateTokenUIPositions",
            { object: subelement, contextId: battleMapId }
          );
        }
      });
    } else {
      if (event.target.id && event.target.additionalObjects) {
        ClientMediator.sendCommandAsync(
          "BattleMap_Token",
          "UpdateTokenUIPositions",
          { object: event.target, contextId: battleMapId }
        );
      }
    }

    if (event.target.type !== "activeSelection") {
      let action = undefined;
      if (event.transform) {
        action = event.transform.action;
      }
      SendObject(event.target, action);
    } else {
      let objects = canvas.getActiveObjects();
      let action = undefined;
      if (event.transform) {
        action = event.transform.action;
      }
      canvas.discardActiveObject();
      objects.forEach((element) => {
        SendObject(element, action);
      });
      var sel = new fabric.ActiveSelection(objects, {
        canvas: canvas,
      });
      canvas.setActiveObject(sel);
    }

    function SendObject(target, action) {
      const dto = DTOConverter.ConvertToDTO(target);
      let cmd = CommandFactory.CreateBattleMapUpdateCommand(
        dto,
        battleMapId,
        action
      );
      console.log(cmd);
      WebSocketManagerInstance.Send(cmd);
    }
  }
}
