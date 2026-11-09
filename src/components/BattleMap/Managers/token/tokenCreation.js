import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import ClientMediator from "../../../../ClientMediator";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import UtilityHelper from "../../../../helpers/UtilityHelper";

// Telling tokens apart, and placing a new one.
export const tokenCreation = {
  meta: {
    IsToken: {
      description:
        'Returns true when the canvas object with the given ID has the "isToken" property set.',
      args: [{ name: "id", type: "string", required: true }],
    },
    GetTokenCardID: {
      description:
        "Returns the card ID linked to the given canvas object (token).",
      args: [{ name: "id", type: "string", required: true }],
    },
    CreateToken: {
      description:
        "Spawns a new token on the map at the given position, for a card (cardId) or, with no card, from a token definition (token: its resource key or id; image: optional).",
      args: [
        { name: "cardId", type: "string", required: false },
        { name: "token", type: "string", required: false },
        { name: "image", type: "string", required: false },
        { name: "x", type: "number", required: false },
        { name: "y", type: "number", required: false },
      ],
    },
  },

  methods: {
    // ── Query commands ──────────────────────────────────────────────────────

    async IsToken({ objectId, id, isCommand }) {
      if (isCommand && !id) return "--id is required";

      const result = await ClientMediator.sendCommandAsync(
        "Properties",
        "GetByNames",
        { parentId: id ?? objectId, names: ["isToken"] }
      );
      return UtilityHelper.ParseBool(result?.[0]?.value ?? false);
    },

    async GetTokenCardID({ objectId, id, isCommand }) {
      if (isCommand && !id) return "--id is required";

      const result = await ClientMediator.sendCommandAsync(
        "Properties",
        "GetByNames",
        { parentId: id ?? objectId, names: ["cardId"] }
      );
      return result?.[0]?.value;
    },

    // ── Token creation ──────────────────────────────────────────────────────

    /**
     * Places a token: either for a card (cardId: the definition, name, size and image
     * come from the card's properties) or, with no card, straight from a token
     * definition (token: its resource key or id; image: optional). A card-less token
     * keeps its own values, image included, on the element itself.
     */
    CreateToken({ cardId, token, image, position, x, y, isCommand }) {
      if (isCommand && !cardId && !token) return "--cardId or --token is required";

      // Normalise position — use explicit x/y from command, or the provided object
      const pos = isCommand
        ? { x: parseFloat(x) || 0, y: parseFloat(y) || 0 }
        : { x: position?.x ?? 0, y: position?.y ?? 0 };

      this._createTokenAsync({ cardId, tokenRef: token, image }, pos);
    },

    /**
     * Internal: resolve the token definition and its inputs (from the card, or
     * from the definition alone), build the Fabric object, and send element_add.
     */
    // The token is built on the server (materials/BuildToken, as the SpawnToken action step
    // builds one): from the card's token file, picture, size and name, or from a token file.
    // It comes sized to the grid at scale 1; the picture is fitted to it when it loads.
    async _createTokenAsync({ cardId, tokenRef, image }, position) {
      const map = this._getSelectedMap();
      if (!map) {
        console.error("TokenManager._createTokenAsync: no map selected");
        return;
      }

      const resp = await WebHelper.postAsync("materials/BuildToken", {
        mapId: map.id, cardId, token: tokenRef, image, x: position.x, y: position.y,
      });
      if (!resp || resp.status < 200 || resp.status >= 300 || !resp.body?.object) {
        console.error("TokenManager._createTokenAsync: the token could not be built", resp?.body?.error ?? resp?.status);
        return;
      }

      const object = JSON.parse(resp.body.object);
      WebSocketManagerInstance.Send({
        command: "element_add",
        data: {
          object: resp.body.object,
          layer: object.layer,
          mapId: map.id,
          withSelection: true,
          properties: [
            { name: "tokenSize", value: String(resp.body.size) },
            { name: "isToken", value: "true" },
          ],
        },
      });
    },
  },
};
