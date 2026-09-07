import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import {
  BehaviorDictionaryClient,
  BehaviorDictionaryServer,
} from "../Behaviors/BehaviorDictionary";

// Note: this used to build a `cleanups` array of {unsubscribe} closures, but its
// only caller (LoadCanvas.js) never used the return value — canvas.clear() at the
// top of every LoadCanvas() run already resets canvas state in practice, and the
// WS subscription below is idempotent by name. Removed rather than wiring up
// teardown nobody needs.
const LoadBMSubscriptions = (canvas, references) => {
  try {
    if (!references) {
      console.warn('LoadBMSubscriptions: references is falsy', { references });
      return;
    }

    // Resolve battleMapObjectRef from several possible shapes
    const candidate = references?.battleMapObjectRef ?? references?.current?.battleMapObjectRef ?? references?.current ?? references;

    let bmRef = null;

    if (candidate && typeof candidate === 'object') {
      if (candidate.current) {
        bmRef = candidate;
      } else if (candidate.id || candidate.Panel || candidate.PanelContentID) {
        // candidate looks like the actual object (not a ref) -> wrap it
        bmRef = { current: candidate };
      }
    }

    if (!bmRef) {
      console.warn('LoadBMSubscriptions: could not resolve battleMapObjectRef', { references });
      return;
    }

    if (!bmRef.current || !bmRef.current.id) {
      console.warn('LoadBMSubscriptions: battleMapObjectRef.current or id is not available yet; skipping subscriptions', { bmRefCurrent: bmRef.current });
      return;
    }

    const battleMapId = bmRef.current.id;
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

    // If canvas is not provided, skip canvas event subscriptions but keep ws subscription
    if (!canvas) {
      console.warn('LoadBMSubscriptions: canvas is not available - skipping client-side behavior subscriptions');
      return;
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
        } catch (e) {
          console.error('LoadBMSubscriptions: failed to register canvas handler', e);
        }
      });
    });
  } catch (e) {
    console.error('LoadBMSubscriptions: unexpected error', e, { references, canvas });
  }
};

export default LoadBMSubscriptions;
