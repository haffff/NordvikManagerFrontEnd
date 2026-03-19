import WebSocketManagerInstance from "../../game/WebSocketManager";
import {
  BehaviorDictionaryClient,
  BehaviorDictionaryServer,
} from "../Behaviors/BehaviorDictionary";

const LoadBMSubscriptions = (canvas, references) => {
  const cleanups = [];

  try {
    if (!references) {
      console.warn('LoadBMSubscriptions: references is falsy', { references });
      return cleanups;
    }

    // Resolve battleMapObjectRef from several possible shapes
    const candidate = references?.battleMapObjectRef ?? references?.current?.battleMapObjectRef ?? references?.current ?? references;

    let bmRef = null;

    if (candidate && typeof candidate === 'object') {
      if (candidate.current) {
        bmRef = candidate;
      } else if (candidate.Id || candidate.Panel || candidate.PanelContentID) {
        // candidate looks like the actual object (not a ref) -> wrap it
        bmRef = { current: candidate };
      }
    }

    if (!bmRef) {
      console.warn('LoadBMSubscriptions: could not resolve battleMapObjectRef', { references });
      return cleanups;
    }

    if (!bmRef.current || !bmRef.current.Id) {
      console.warn('LoadBMSubscriptions: battleMapObjectRef.current or Id is not available yet; skipping subscriptions', { bmRefCurrent: bmRef.current });
      return cleanups;
    }

    const battleMapId = bmRef.current.Id;
    const subscriptionName = "BattleMap" + battleMapId;

    // WebSocket subscription
    const wsHandler = (response) => {
      try {
        if (
          response.command !== undefined &&
          BehaviorDictionaryServer[response.command] !== undefined
        ) {
          if (response.result === "NoPermission") {
            return;
          }
          BehaviorDictionaryServer[response.command].Handle(
            response,
            canvas,
            battleMapId
          );
        }
      } catch (e) {
        console.error('LoadBMSubscriptions: error in wsHandler', e);
      }
    };

    WebSocketManagerInstance.Subscribe(subscriptionName, wsHandler);
    cleanups.push({ unsubscribe: () => WebSocketManagerInstance.Unsubscribe(subscriptionName) });

    // If canvas is not provided, skip canvas event subscriptions but keep ws subscription
    if (!canvas) {
      console.warn('LoadBMSubscriptions: canvas is not available - skipping client-side behavior subscriptions');
      return cleanups;
    }

    // Resolve mapRef if available
    const mapRef = references?.mapRef ?? references?.current?.mapRef ?? null;

    // attempt to draw grid if mapRef is present and canvas is ready
    try {
      const map = mapRef?.current;
      if (map) {
        const GridHelper = require('../Helpers/GridHelper').default;
        GridHelper(canvas, map);
      }
    } catch (e) {
      // ignore grid errors here
    }

    // Remove existing client handlers for keys defined in BehaviorDictionaryClient
    Object.keys(BehaviorDictionaryClient).forEach((key) => {
      try {
        canvas.off(key);
      } catch (e) {
        // ignore if off fails
      }
    });

    // Add handlers and keep references for cleanup
    const addedHandlers = [];

    Object.keys(BehaviorDictionaryClient).forEach((key) => {
      BehaviorDictionaryClient[key]?.forEach((handler) => {
        const fn = (e) => {
          try {
            handler.Handle(
              e,
              canvas,
              mapRef?.current,
              battleMapId
            );
          } catch (err) {
            console.error('LoadBMSubscriptions: handler threw', err);
          }
        };

        try {
          canvas.on(key, fn);
          addedHandlers.push({ key, fn });
        } catch (e) {
          console.error('LoadBMSubscriptions: failed to register canvas handler', e);
        }
      });
    });

    cleanups.push({ unsubscribe: () => {
      addedHandlers.forEach(({ key, fn }) => {
        try {
          canvas.off(key, fn);
        } catch (e) {
          // ignore
        }
      });
    }});

    return cleanups;
  } catch (e) {
    console.error('LoadBMSubscriptions: unexpected error', e, { references, canvas });
    return cleanups;
  }
};

export default LoadBMSubscriptions;
