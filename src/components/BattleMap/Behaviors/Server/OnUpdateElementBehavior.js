import ClientMediator from "../../../../ClientMediator";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import DTOConverter from "../../DTOConverter";

export class OnUpdateElementBehavior {
  async Handle(response, canvas, battleMapId) {
    ClientMediator.sendCommandWaitForRegister(
      "Game",
      "GetCurrentPlayer",
      {},
      true
    ).then(async (currentPlayer) => {
      let obj = canvas.getObjects().find((x) => x.id === response.data.id);
      if (obj) {
        // Skip update only if this is an in-progress drag by the current player
        // (the client already has optimistic position; applying the server echo would stutter)
        const isOwnDrag =
          response.battleMapId === battleMapId &&
          response.playerId === currentPlayer.id &&
          response.action === "drag" &&
          obj.isBeingDragged;

        if (isOwnDrag) {
          canvas.requestRenderAll();
          return;
        }
        let parsedJson = DTOConverter.ConvertFromDTO(response.data);
        const isToken = (parsedJson.additionalObjects ? true : false);
        //parsedJson.selectable = (response.data.permission & 4 === 4) && parsedJson.data.layer === battleMapObject.SelectedLayer;

        obj?.additionalObjects?.forEach((element) => {
          if (element.visibleBeforeDrag === undefined) {
            element.set({ visibleBeforeDrag: element.visible });
            element.set({ visible: false });
          }
        });

        if (response.action !== undefined) {
          const options = {
            duration: 100,
            onChange: canvas.renderAll.bind(canvas),
            onComplete: async () => {
              obj.set(parsedJson);
              if (isToken) {
                await ClientMediator.sendCommandAsync(
                  "BattleMap_Token",
                  "UpdateTokenUIPositions",
                  { object: obj, contextId: battleMapId }
                );
              }
              obj?.additionalObjects?.forEach((element) => {
                if (element.visibleBeforeDrag !== undefined) {
                  element.set({
                    visible: element.visibleBeforeDrag,
                    visibleBeforeDrag: undefined,
                  });
                }
              });

              canvas.requestRenderAll();
            },
          };
          switch (response.action) {
            case "drag":
              let newX = parsedJson.left;
              let newY = parsedJson.top;
              obj.animate({ left: newX, top: newY }, options);
              break;
            case "layer":
              let selectedLayer = ClientMediator.sendCommand(
                "BattleMap",
                "GetSelectedLayer",
                { contextId: battleMapId }
              );
              obj.set("layer", parsedJson.layer);
              obj.set(
                "selectable",
                obj.selectablePermission && obj.layer === selectedLayer
              );
              obj?.additionalObjects?.forEach((element) => {
                element.set("layer", parsedJson.layer);
                element.set(
                  "selectable",
                  obj.selectablePermission && obj.layer === selectedLayer
                );
              }, options);
              canvas._objects.sort((a, b) =>
                a.layer > b.layer || a.insideLayerIndex > b.insideLayerIndex
                  ? 1
                  : -1
              );
              break;
            default:
              obj.set(parsedJson);
              if (isToken) {
                await ClientMediator.sendCommandAsync(
                  "BattleMap_Token",
                  "UpdateTokenUIPositions",
                  { object: obj, contextId: battleMapId }
                );
              }
              obj?.additionalObjects?.forEach((element) => {
                if (element.visibleBeforeDrag !== undefined) {
                  element.set({
                    visible: element.visibleBeforeDrag,
                    visibleBeforeDrag: undefined,
                  });
                }
              });

              canvas.requestRenderAll();
          }
        } else {
          obj.set(parsedJson);
          if (isToken) {
            await ClientMediator.sendCommandAsync(
              "BattleMap_Token",
              "UpdateTokenUIPositions",
              { object: obj, contextId: battleMapId }
            );
          }
          obj?.additionalObjects?.forEach((element) => {
            if (element.visibleBeforeDrag !== undefined) {
              element.set({
                visible: element.visibleBeforeDrag,
                visibleBeforeDrag: undefined,
              });
            }
          });

          canvas.requestRenderAll();
        }

        obj.set("dirty", true);
      }

      canvas.requestRenderAll();
    });
  }
}
