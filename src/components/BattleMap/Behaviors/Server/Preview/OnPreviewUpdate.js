import ClientMediator from "../../../../../ClientMediator";

export class OnPreviewUpdateBehavior {
  currentPlayer = null;

  async Handle(response, canvas, battleMapId) {
    if (this.currentPlayer === null) {
      this.currentPlayer = await ClientMediator.sendCommandAsync(
        "Game",
        "GetCurrentPlayer"
      );
    }

    const updates = response.data;
    if (updates && response.battleMapId === battleMapId && this.currentPlayer.id !== response.playerId) {
      updates.forEach((update) => {
        //Find object by previewId
        const obj = canvas
          .getObjects()
          .find((o) => o.previewId === update.previewId);
        if (!obj) {
          return;
        }
        obj.set(update);
      });
      canvas.requestRenderAll();
    }
    canvas.requestRenderAll();
  }
}
