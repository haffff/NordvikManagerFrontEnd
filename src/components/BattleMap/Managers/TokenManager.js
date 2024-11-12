import WebSocketManagerInstance from "../../game/WebSocketManager";
import { fabric } from "fabric";
import DTOConverter from "../DTOConverter";
import ClientMediator from "../../../ClientMediator";

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
    this.panel = "battlemap-token";
    this.contextId = this._battleMapModel.id;
    this.id = "TokenManager" + this._battleMapModel.id;
  }

  CreateToken(cardId, position) {
    const names = ["token", "tokenImage", "drop_token_size", "character_name","player_owner"];
    const map = ClientMediator.sendCommand("BattleMap", "GetSelectedMap", { contextId: this._battleMapModel.id });
    const {gridSize} = map;
    //get token from card
    ClientMediator.sendCommand(
      "Properties",
      "GetByNames",
      {
        parent: cardId,
        names: names,
      },
      (response) => {
        let tokenDefinition = response.find((x) => x.name === "token");
        if (tokenDefinition) {
          let tokenDefinition = JSON.parse(token.value);
          let token = new fabric.Object();
          
        }
      }
    );
  }
}

export default TokenManager;
