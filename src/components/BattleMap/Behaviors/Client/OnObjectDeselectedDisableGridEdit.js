import ClientMediator from "../../../../ClientMediator";
import WebSocketManagerInstance from "../../../game/WebSocketManager";
import DTOConverter from "../../DTOConverter";
import CommandFactory from "../../Factories/CommandFactory";
import { fabric } from "fabric";

export class OnObjectDeselectedDisableGridEdit {
  Handle(event, canvas, map, battleMapId) {
    //get active object
    if(!canvas.editGridMode)
    {
      return;
    }
    console.warn("Disabling grid edit mode");
    let possibleGrid = event.deselected.find((obj) => obj.name === ".grid");
    if(possibleGrid)
    {
        canvas.editGridMode = false;
    }
  }
}
