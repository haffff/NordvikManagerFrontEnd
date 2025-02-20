import ClientMediator from "../../../ClientMediator";
import UtilityHelper from "../../../helpers/UtilityHelper";
import WebSocketManagerInstance from "../../game/WebSocketManager";
import BattleMapModes from "../BattlemapModes";
import {
  BehaviorDictionaryClient,
  BehaviorDictionaryServer,
} from "../Behaviors/BehaviorDictionary";

const LoadBMSubscriptions = (canvas, references) => {
  //Register behaviors(actions) handling events from server.
  WebSocketManagerInstance.Subscribe(
    "BattleMap" + references.battleMapObjectRef.current.Id,
    (response) => {
      if (
        response.command !== undefined &&
        BehaviorDictionaryServer[response.command] !== undefined
      ) {
        if (response.result == "NoPermission") {
          return;
        }
        BehaviorDictionaryServer[response.command].Handle(
          response,
          canvas,
          references.battleMapObjectRef.current.Id
        );
      }
    }
  );

  //Handle events from battlemap itself(rest should go trough server)
  //for example here is moving elements on map
  Object.keys(BehaviorDictionaryClient).forEach((key) => {
    canvas.off(key);
  });

  Object.keys(BehaviorDictionaryClient).forEach((key) => {
    BehaviorDictionaryClient[key]?.forEach((handler) => {
      canvas.on(key, (e) => {
        handler.Handle(
          e,
          canvas,
          references.mapRef.current,
          references.battleMapObjectRef.current.Id
        );
      });
    });
  });
};

export default LoadBMSubscriptions;
