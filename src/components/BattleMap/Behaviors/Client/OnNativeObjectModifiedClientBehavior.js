import WebSocketManagerInstance from "../../../game/WebSocketManager";
import DTOConverter from "../../DTOConverter";
import CommandFactory from "../../Factories/CommandFactory";
import { fabric } from "fabric";

export class OnNativeObjectModifiedClientBehavior {
  Handle(event, canvas, map, keyboardEventsManagerRef, battleMapObject) {
    var renderGrid = map.gridVisible;

    //align to grid when exists and no alt is pressed
    if (renderGrid && !keyboardEventsManagerRef.current.KeyboardMap.Shift) {
      var gridSize = map.gridSize;
      event.target.set({
        left: Math.round(event.target.left / gridSize) * gridSize,
        top: Math.round(event.target.top / gridSize) * gridSize,
      });
    }

    if (event.target.type === "activeSelection") {
      event.target.forEachObject((subelement) => {
        subelement.additionalObjects?.forEach((element) => {
          element.set({
            left: event.target.left + subelement.left + element.originalLeft,
            top: event.target.top + subelement.top + element.originalTop,
          });
        });
      });
    } else {
      event.target.additionalObjects?.forEach((element) => {
        element.set({
          left: event.target.left + element.originalLeft,
          top: event.target.top + element.originalTop,
        });
      });
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
      const dto = DTOConverter.ConvertToDTO(target); //battleMapObject.BattleMapServices.ElementsStorage.Get(target.id);
      let cmd = CommandFactory.CreateBattleMapUpdateCommand(
        dto,
        battleMapObject.Id,
        action
      );
      console.log(cmd);
      WebSocketManagerInstance.Send(cmd);
    }
  }
}
