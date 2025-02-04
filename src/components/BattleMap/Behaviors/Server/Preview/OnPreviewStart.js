import { fabric } from "fabric";
import ClientMediator from "../../../../../ClientMediator";

export class OnPreviewStartBehavior {
  currentPlayer = null;

  async Handle(response, canvas, battleMapId) {
    if (this.currentPlayer === null) {
      this.currentPlayer = await ClientMediator.sendCommandAsync(
        "Game",
        "GetCurrentPlayer"
      );
    }

    if (response.data && response.battleMapId === battleMapId && this.currentPlayer.id !== response.playerId) {
      const objects = response.data;
      fabric.util.enlivenObjects(objects, (elements) => {
        elements.forEach((element, i) => {
          let previewId = objects[i].previewId;
          let stayVisible = objects[i].stayVisible;
          let playerId = objects[i].playerId;
          element.set({
            selectable: false,
            previewId: previewId,
            playerId: playerId,
            stayVisible: stayVisible,
            preview: true,
          });
          canvas.add(element);
        });
        canvas.requestRenderAll();
      });
    }
  }
}
