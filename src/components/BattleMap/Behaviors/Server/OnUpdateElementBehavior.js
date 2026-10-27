import ClientMediator from "../../../../ClientMediator";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import DTOConverter from "../../DTOConverter";
import { compareLayers } from "../../Constants/layers";
import { syncControlsVisibility } from "../../Helpers/TokenControlsHelper";

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
        // Object is inside an ActiveSelection — its left/top are group-local coordinates,
        // not canvas-space. Applying canvas-space echo coordinates would misplace it drastically.
        if (obj.group) {
          canvas.requestRenderAll();
          return;
        }

        // Skip update only if this is an in-progress drag by the current player
        // (the client already has optimistic position; applying the server echo would stutter)
        const isOwnDrag =
          response.battleMapId === battleMapId &&
          response.playerId === currentPlayer.id &&
          response.action === "drag" &&
          obj.isBeingDragged;

        if (isOwnDrag) {
          obj.isBeingDragged = false; // consume — this echo has now been accounted for
          canvas.requestRenderAll();
          return;
        }
        let parsedJson = DTOConverter.ConvertFromDTO(response.data);
        // Drag/scale/rotate updates carry a minified DTO (only the changed fields,
        // e.g. left/top) which never includes additionalObjects — checking the
        // parsed payload here always says "not a token" for those actions, so the
        // token image moves but its attached UI (name tag, HP bar, status icons)
        // never gets repositioned and is left behind on every other client.
        // The live canvas object always has this set correctly, so check that instead.
        const isToken = !!obj.additionalObjects?.length;
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
              // insideLayerIndex (bring-forward/send-backward position) must be applied
              // alongside layer — otherwise it's silently dropped from remote updates
              // even when the sender did transmit it (see DTOConverter.ConvertToDTO).
              obj.set("insideLayerIndex", parsedJson.insideLayerIndex);
              obj.set(
                "selectable",
                obj.selectablePermission && obj.layer === selectedLayer
              );
              // The token's parts stay on the token UI layer and unselectable, as a freshly
              // loaded token has them; they're drawn and clicked with the token's layer
              // (drawLayerOf), so they follow it there.
              // Moved to a layer this player doesn't see: no selection left on it.
              if (canvas.layerView?.hidden.has(obj.layer) && canvas.getActiveObjects?.().includes(obj)) {
                canvas.discardActiveObject();
              }
              // Hidden above like for any update — nothing animates here to show them again.
              obj?.additionalObjects?.forEach((element) => {
                if (element.visibleBeforeDrag !== undefined) {
                  element.set({
                    visible: element.visibleBeforeDrag,
                    visibleBeforeDrag: undefined,
                  });
                }
              });
              canvas._objects.sort(compareLayers);
              canvas.requestRenderAll();
              break;
            default:
              obj.set(parsedJson);
              syncControlsVisibility(obj);
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
          syncControlsVisibility(obj);
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
