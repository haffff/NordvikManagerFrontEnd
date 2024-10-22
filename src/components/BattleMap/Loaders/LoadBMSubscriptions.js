import ClientMediator from "../../../ClientMediator";
import UtilityHelper from "../../../helpers/UtilityHelper";
import WebSocketManagerInstance from "../../game/WebSocketManager";
import BattleMapModes from "../BattlemapModes";
import { BehaviorDictionaryClient, BehaviorDictionaryServer } from "../Behaviors/BehaviorDictionary";

const LoadBMSubscriptions = (canvas, references) => {
  
  //Register behaviors(actions) handling events from server.
  WebSocketManagerInstance.Subscribe("BattleMap" + references.battleMapObjectRef.current.Id, (response) => {
    if (response.command !== undefined && BehaviorDictionaryServer[response.command] !== undefined) {
      if (response.result == "NoPermission") {
        return;
      }
      BehaviorDictionaryServer[response.command].Handle(response, canvas, references.battleMapObjectRef.current.Id);
    }
  });

  //Handle events from battlemap itself(rest should go trough server)
  //for example here is moving elements on map
  Object.keys(BehaviorDictionaryClient).forEach(key => {
    canvas.off(key);
    canvas.on(key, (e) => {
      if (BehaviorDictionaryClient[key] !== undefined)
        BehaviorDictionaryClient[key].Handle(e, canvas, references.mapRef.current, references.keyboardEventsManagerRef, references.battleMapObjectRef.current)
    });
  });

  canvas.off('mouse:wheel');
  canvas.on('mouse:wheel', function (opt) {
    var delta = opt.e.deltaY;
    var zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 10) zoom = 10;
    if (zoom < 0.01) zoom = 0.01;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
    canvas.requestRenderAll();
  });

  canvas.off('mouse:down');
  canvas.on('mouse:down', (opt) => {
    console.log(references.operationRef.current);

    ClientMediator.fireEvent("ActivePanelChanged", { panel: "BattleMap", contextId: references.battleMapObjectRef.current.Id });
    
    canvas.lastAbsolutePointer = canvas.getPointer(opt.e);

    if (opt.button === 3) {
      references.contextMenuVisibleRef.current = true;
      const rect = references.battleMapContainerRef.current.getBoundingClientRect();

      references.contextMenuRef.current.style.left = `${opt.e.clientX - rect.x}px`;
      references.contextMenuRef.current.style.top = `${opt.e.clientY - rect.y}px`;
      references.contextMenuRef.current.style.display = 'block';
    }
    else {
      references.contextMenuVisibleRef.current = false;
      references.contextMenuRef.current.style.display = 'none';
    }

    canvas.on('object:moving', function (event) {
      var obj = event.target;
      if(obj && obj.properties && UtilityHelper.ParseBool(obj.properties["isToken"]?.value))
      {
        obj.additionalObjects?.forEach(element => {
          element.set({ left: obj.left + element.originalLeft, top: obj.top + element.originalTop });
        });
      }
   });

    var evt = opt.e;
    if(opt.button === 2)
    {
      canvas.isDragging = true;
      canvas.selection = false;
      canvas.lastPosX = evt.clientX;
      canvas.lastPosY = evt.clientY;
      return;
    }

    switch (references.operationRef.current) {
      case BattleMapModes.DRAG:
        canvas.isDragging = true;
        canvas.selection = false;
        canvas.lastPosX = evt.clientX;
        canvas.lastPosY = evt.clientY;
        break;
      case BattleMapModes.SELECT:
        canvas.isDragging = false;
        canvas.selection = true;
        break;
      case BattleMapModes.DISPLAY:
        canvas.selection = false;
        let canvasCoords = canvas.getPointer(opt);
        if (references.argumentsRef.current.onStart) {
          references.argumentsRef.current.onStart(canvasCoords, canvas);
        }
        canvas.isDisplaying = true;
        break;
      default:
        break;
    }
  });

  canvas.off('mouse:move');
  canvas.on('mouse:move', (opt) => {
    if (canvas.isDragging) {
      var e = opt.e;
      var vpt = canvas.viewportTransform;
      vpt[4] += e.clientX - canvas.lastPosX;
      vpt[5] += e.clientY - canvas.lastPosY;
      canvas.requestRenderAll();
      canvas.lastPosX = e.clientX;
      canvas.lastPosY = e.clientY;
    }

    if (canvas.isDisplaying) {
      let canvasCoords = canvas.getPointer(opt);
      if (references.argumentsRef.current.onUpdate) {
        references.argumentsRef.current.onUpdate(canvasCoords, canvas);
      }
      canvas.requestRenderAll();
    }

    if (references.popupVisibleRef && references.popupVisibleRef.current) {
      const rect = references.battleMapContainerRef.current.getBoundingClientRect();
      references.popupRef.current.style.left = `${opt.e.clientX - rect.x}px`;
      references.popupRef.current.style.top = `${opt.e.clientY - rect.y}px`;
      references.popupRef.current.style.display = 'block';
    }
    else {
      references.popupRef.current.style.display = 'none';
    }
  });

  canvas.off('mouse:up');
  canvas.on('mouse:up', (opt) => {
    // on mouse up we want to recalculate new interaction
    // for all objects, so we call setViewportTransform
    if (canvas.isDragging) {
      canvas.setViewportTransform(canvas.viewportTransform);
      canvas.isDragging = false;
      canvas.selection = true;
    }

    if (canvas.isDisplaying) {
      canvas.isDisplaying = false;
      let canvasCoords = canvas.getPointer(opt);
      if (references.argumentsRef.current.onEnd) {
        references.argumentsRef.current.onEnd(canvasCoords, canvas);
      }
      canvas.requestRenderAll();
    }
  });

  // canvas.on('mouse:move', (e) => {
  //   if(popupVisible.current)
  //   {
  //     console.log(e);
  //     popupRef.current.style.left = `${e.e.clientX}px`;
  //     popupRef.current.style.top = `${e.e.clientY}px`;
  //     popupRef.current.style.display = 'block';
  //   }
  //   else
  //   {
  //     popupRef.current.style.display = 'none';
  //   }
  // });
}

export default LoadBMSubscriptions;