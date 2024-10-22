import ClientMediator from "../../../../../ClientMediator";

export class OnPreviewUpdateBehavior {
  Handle(response, canvas, battleMapId) {

    ClientMediator.sendCommandAsync("Game", "GetCurrentPlayer", {}, true).then((currentPlayer) => {
      let obj = canvas.getObjects().find(x => x.id === response.data.id);
      if (obj &&
        !(response.battleMapId === battleMapId && response.playerId === currentPlayer.id)
      ) {
        obj.set(response.data);
        canvas.requestRenderAll();
      }
      canvas.requestRenderAll();
    });
  }
}