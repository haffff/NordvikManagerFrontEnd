import ClientMediator from "../../../../ClientMediator";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import DTOConverter from "../../DTOConverter";
import CommandFactory from "../../Factories/CommandFactory";
import { fabric } from "fabric";

export class OnNativeObjectModifiedClientBehavior {
  Handle(event, canvas, map, battleMapId) {
    var renderGrid = map.gridVisible;
    const isMultiSelect = event.target.type === "activeSelection";
    const shouldSnap = renderGrid && canvas.alignMode !== "none" && !event.transform?.altKey;

    if (shouldSnap) {
      var gridSize = map.gridSize;

      if (!isMultiSelect) {
        // Single object: event.target.left is the left edge (originX:'left') — snap directly.
        let x = Math.round(event.target.left / gridSize) * gridSize;
        let y = Math.round(event.target.top / gridSize) * gridSize;

        if (canvas.alignMode === "center") {
          x += gridSize / 2;
          y += gridSize / 2;
        }

        event.target.set({ left: x, top: y });
      } else {
        // ActiveSelection: fabric.Group uses originX:'center', so event.target.left is the
        // bounding-box CENTER, not the left edge. Derive the left/top edges, snap those,
        // then apply the resulting delta back to the group center so that
        // discardActiveObject() restores objects at the correct snapped canvas positions
        // without a visual flash.
        var leftEdge = event.target.left - event.target.width / 2;
        var topEdge  = event.target.top  - event.target.height / 2;

        var snappedLeft = Math.round(leftEdge / gridSize) * gridSize;
        var snappedTop  = Math.round(topEdge  / gridSize) * gridSize;

        if (canvas.alignMode === "center") {
          snappedLeft += gridSize / 2;
          snappedTop  += gridSize / 2;
        }

        event.target.set({
          left: event.target.left + (snappedLeft - leftEdge),
          top:  event.target.top  + (snappedTop  - topEdge),
        });
      }
    }

    if (isMultiSelect) {
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

    if (!isMultiSelect) {
      let action = event.transform?.action;
      SendObject(event.target, action);
    } else {
      let objects = canvas.getActiveObjects();
      let action = event.transform?.action;
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
      //const dto = DTOConverter.ConvertToDTO(target);
      let dto = {};
      //If action is drag we need to call minified converttodto with only necessary fields
      switch(action)
      {
        case "drag":
          dto = DTOConverter.ConvertToDTOMinified(target, ["left", "top"]);
          break;
        case "scale":
          dto = DTOConverter.ConvertToDTOMinified(target, ["scaleX", "scaleY"]);
          break;
        case "rotate":
          dto = DTOConverter.ConvertToDTOMinified(target, ["angle"]);
          break;
        default:
          dto = DTOConverter.ConvertToDTO(target);
      }

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
