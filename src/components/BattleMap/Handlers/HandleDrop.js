import { fabric } from 'fabric';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import CommandFactory from '../Factories/CommandFactory';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';
import ClientMediator from '../../../ClientMediator';

// Factory that returns a drop handler bound to provided refs/instances
export default function createHandleDrop({ editor, mapRef, battleMapObjectRef, battleMapModel }) {
  return function HandleDrop(ev) {
    try {
      if (!editor || !editor.canvas) {
        console.warn('Battlemap HandleDrop: canvas not ready');
        return;
      }

      const map = mapRef?.current;
      const coords = editor.canvas.getPointer(ev);
      const items = ev?.dataTransfer?.items;
      if (!items) return;

      console.debug('Battlemap HandleDrop:', { itemsCount: items.length, coords });

      [...items].forEach((item, i) => {
        if (item.kind === 'string') {
          const raw = sessionStorage.getItem('draggable');
          if (!raw) return;
          let dragObj;
          try { dragObj = JSON.parse(raw); } catch (e) { console.warn('Battlemap HandleDrop: invalid draggable payload', e); return; }

          if (dragObj.entityType === 'ResourceModel') {
            console.debug('Battlemap HandleDrop: resource', dragObj);
            WebHelper && WebHelper.getResourceString &&
              fabric.Image.fromURL(WebHelper.getResourceString(dragObj.id), (img) => {
                const obj = img;
                if (!obj || !obj.width) return;
                obj.left = coords.x + 10 * i;
                obj.top = coords.y + 10 * i;
                obj.resourceId = dragObj.id;
                obj.resourceKey = dragObj.key;
                const cmd = CommandFactory.CreateAddCommand({ object: JSON.stringify(obj), properties: [], mapId: map?.id, layer: editor.canvas.selectedLayer });
                WebSocketManagerInstance.Send(cmd);
              });
          }

          if (dragObj.entityType === 'CardModel') {
            console.debug('Battlemap HandleDrop: card', dragObj);
            ClientMediator.sendCommand('BattleMap_token', 'CreateToken', { contextId: battleMapObjectRef?.current?.id, cardId: dragObj.id, position: coords });
          }

          if (dragObj.entityType === 'MapModel') {
            console.debug('Battlemap HandleDrop: map change', dragObj);
            const command = CommandFactory.CreateChangeMapCommand(dragObj.id, battleMapObjectRef?.current?.id);
            WebSocketManagerInstance.Send(command);
          }
        }

        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (!file) return;
          WebHelper.postMaterial(file, (result) => {
            fabric.Image.fromURL(WebHelper.getResourceString(result.id), (img) => {
              const obj = img;
              obj.left = coords.x + 10 * i;
              obj.top = coords.y + 10 * i;
              obj.resourceId = result.id;
              obj.resourceKey = result.key;
              const cmd = CommandFactory.CreateAddCommand({ object: JSON.stringify(obj), properties: [], mapId: map?.id, layer: editor.canvas.selectedLayer });
              WebSocketManagerInstance.Send(cmd);
            });
          }, (error) => { console.error('Battlemap HandleDrop: upload failed', error); });
        }
      });
    } catch (e) {
      console.error('Battlemap HandleDrop error', e);
    }
  };
}
