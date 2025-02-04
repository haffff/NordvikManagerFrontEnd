import ClientMediator from "../../../../../ClientMediator";

export class OnPreviewEndBehavior {
  currentPlayer = null;

  async Handle(response, canvas, battleMapId) {
    if(this.currentPlayer === null) {
      this.currentPlayer = await ClientMediator.sendCommandAsync("Game", "GetCurrentPlayer");
    }

    if (response.data && response.battleMapId === battleMapId && this.currentPlayer.id !== response.playerId) {
      const removes = response.data;

      // removes.forEach((element) => {
      //   let object = canvas
      //     .getObjects()
      //     .find((x) => x.previewId === element.previewId);
      //   canvas.remove(object);
      // });

      canvas.remove(...canvas.getObjects().filter((x) => response.playerId === x.playerId && x.preview === true));
      canvas.requestRenderAll();
    }
  }
}
