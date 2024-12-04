import { fabric } from 'fabric';
import ClientMediator from '../../../../../ClientMediator';

export class OnPreviewStartBehavior {

  Handle(response, canvas, battleMapId) {
    ClientMediator.sendCommandWaitForRegister("Game", "GetCurrentPlayer", {}, true).then((currentPlayer) => {
      if (response.data &&
        !(response.battleMapId === battleMapId &&
          response.playerId === currentPlayer.id)
      ) {
        const obj = response.data;
        obj.selectable = false;
        fabric.util.enlivenObjects([obj], elements => {
          canvas.add(elements[0]);
          canvas.requestRenderAll();
        });
      }
    });
  }
}