import WebSocketManagerInstance from "../../game/WebSocketManager";
import { fabric } from "fabric";
import DTOConverter from "../DTOConverter";
import ClientMediator from "../../../ClientMediator";
import WebHelper from "../../../helpers/WebHelper";
import UtilityHelper from "../../../helpers/UtilityHelper";

class TokenManager {
  _clipboard = undefined;
  _canvas = undefined;
  _refreshCommand = undefined;
  _reloadCommand = undefined;
  _changeMapCommand = undefined;
  _BMQueryService = undefined;
  _setSelectedLayerCommand = undefined;
  _setPopupContent = undefined;
  _popupVisible = undefined;
  _operationModeRef = undefined;
  _argumentsRef = undefined;
  _isPreviewModel = false;
  _battleMapModel = undefined;

  Load() {
    this.panel = "battlemap_token";
    this.contextId = this._battleMapModel.id;
    this.id = "TokenManager" + this._battleMapModel.id;
  }

//to fix, there should not be canvas ref
  CanvasObjectLoadToken({id}) {
    const canvas = this._canvas;
    const object = canvas._objects.find((x) => x.id === id);

    //Create additional objects dependencies
    if (object.tokenUiElements) {
      fabric.util.enlivenObjects(object.tokenUiElements, (e) => {
        e.forEach((element) => {
          if (element.showOnTokenControl) {
            element.visible = false;
          }

          element.enabled = UtilityHelper.ParseBool(
            object.properties["show_" + element.name]?.value
          );

          if (element.enabled === false) {
            element.visible = false;
          }

          // set relative position
          element.originalTop = element.top;
          element.originalLeft = element.left;
          element.top = object.top + element.top;
          element.left = object.left + element.left;
          element.layer = object.layer;
          element.insideLayerIndex = object.insideLayerIndex;
          element.selectable = false;
          element.isTokenUI = true;

          if (element.type === "i-text" && element.editable) {
            element.on("mousedblclick", (e) => {
              e.target.enterEditing();
              e.target.selectAll();

              canvas.on("mouse:down", (a) => {
                e.target.exitEditing();
              });
            });
          }

          object.additionalObjects = object.additionalObjects || [];
          object.additionalObjects.push(element);

          canvas.add(element);
        });
      });
    }
  }

  CreateToken({ cardId, position, x, y, isCommand }) {
    if (isCommand && !cardId) {
      return "--cardId is required";
    }

    if (isCommand) {
      position = { x, y };
    }

    if (!position || !position.x || !position.y) {
      position = { x: 0, y: 0 };
    }

    this._CreateToken(cardId, position).then((token) => {});
  }

  async _CreateToken(cardId, position) {
    const names = [
      "token",
      "tokenImage",
      "drop_token_size",
      "character_name",
      "player_owner",
      "drop_token_size",
    ];

    const map = ClientMediator.sendCommand("BattleMap", "GetSelectedMap", {
      contextId: this.contextId,
    });
    const { gridSize } = map;

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${cardId}&names=${names.join(",")}`
    );

    const tokenId = properties.find((p) => p.name === "token").value;
    const characterName = properties.find(
      (p) => p.name === "character_name"
    ).value;
    const playerOwner = properties.find((p) => p.name === "player_owner").value;
    const tokenSize = properties.find(
      (p) => p.name === "drop_token_size"
    ).value;

    const tokenRaw = await WebHelper.getMaterialAsync(
      tokenId,
      "application/json"
    );
    const tokenImageId = properties.find((p) => p.name === "tokenImage").value;

    const token = JSON.parse(tokenRaw);

    const fabricObject = fabric.Image.fromURL(tokenImageId, (object) => {
      object.set({
        ...token,
        name: token.prefix + characterName,
        left: position.x,
        top: position.y,
        cardId: cardId,
        isToken: true,
        tokenUiElements: token.additions,
        mapId: map.id,
        layer: 100,
        src: tokenImageId,
      });

      object.scaleToWidth(gridSize * (tokenSize ?? token.size));

      var dto = DTOConverter.ConvertToDTO(object);
      WebSocketManagerInstance.Send({
        command: "element_add",
        data: {
          ...dto,
          properties: [
            { name: "isToken", value: "true" },
            { name: "cardId", value: cardId },
            { name: "player_owner", value: playerOwner },
          ],
          withSelection: true,
        },
      });
    });
  }
}

export default TokenManager;
