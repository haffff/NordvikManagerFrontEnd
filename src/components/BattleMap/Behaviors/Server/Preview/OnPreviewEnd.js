import ClientMediator from "../../../../../ClientMediator";

export class OnPreviewEndBehavior {
  currentPlayer = null;

  async Handle(response, canvas, battleMapId) {
    if(this.currentPlayer === null) {
      this.currentPlayer = await ClientMediator.sendCommandAsync("Game", "GetCurrentPlayer");
    }

    if (response.data && response.battleMapId === battleMapId && this.currentPlayer.id !== response.playerId) {
      // playerId is stamped by the server, so it is who really sent this.
      const ids = new Set((Array.isArray(response.data) ? response.data : []).map((d) => d?.previewId).filter(Boolean));
      const senderIsGM = response.playerId === ClientMediator.sendCommand("Game", "GetOwner");

      const removes = ids.size > 0
        // Just the listed previews: the sender's own, or anyone's when the GM clears them.
        ? canvas.getObjects().filter((x) => ids.has(x.previewId) && (senderIsGM || x.playerId === response.playerId))
        : canvas.getObjects().filter((x) => response.playerId === x.playerId && x.preview === true);

      canvas.remove(...removes);
      canvas.requestRenderAll();
    }
  }
}
