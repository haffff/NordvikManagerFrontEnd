import ClientMediator from "../../../../ClientMediator";
import DTOConverter from "../../DTOConverter";

export class OnUpdateElementBehavior {
  Handle(response, canvas, battleMapId) {
    ClientMediator.sendCommandWaitForRegister("Game", "GetCurrentPlayer", {}, true).then((currentPlayer) => {
      let obj = canvas.getObjects().find(x => x.id === response.data.id);
      if (obj &&
        !(response.battleMapId === battleMapId && response.playerId === currentPlayer.id)
      ) {
        let parsedJson = DTOConverter.ConvertFromDTO(response.data);
        //parsedJson.selectable = (response.data.permission & 4 === 4) && parsedJson.data.layer === battleMapObject.SelectedLayer;

        if (response.action !== undefined) {
          const options = { duration: 100, onChange: canvas.renderAll.bind(canvas), onCompletion: () => { obj.set(parsedJson) } };
          switch (response.action) {
            case "drag":
              let newX = parsedJson.left;
              let newY = parsedJson.top;
              obj.animate({ left: newX, top: newY }, options);

              obj?.additionalObjects?.forEach(element => {
                element.animate({ left: element.originalLeft + newX, top: element.originalTop + newY }, options);
              }, options);

              break;
            case "layer":
              let selectedLayer = ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", { contextId: battleMapId });
              obj.set("layer", parsedJson.layer);
              obj.set("selectable", obj.selectablePermission && obj.layer === selectedLayer);
              obj?.additionalObjects?.forEach(element => {
                element.set("layer", parsedJson.layer);
                element.set("selectable", obj.selectablePermission && obj.layer === selectedLayer);
              }, options);
              canvas._objects.sort((a, b) => (a.layer > b.layer || a.insideLayerIndex > b.insideLayerIndex) ? 1 : -1);


              break;
            // case "scale":
            //   obj[0].animate({scaleX: parsedJson.scaleX,scaleY: parsedJson.scaleY}, options);
            //   break;
            default:
              obj.set(parsedJson);
          }
        }
        else {
          obj.set(parsedJson);
        }
        obj.set('dirty', true);
      }
      canvas.requestRenderAll();
    });
  }
}