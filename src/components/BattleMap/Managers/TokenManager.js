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

  _getCanvas = undefined;

  Load(getCanvas) {
    this.panel = "battlemap_token";
    this.contextId = this._battleMapModel.id;
    this.id = "TokenManager" + this._battleMapModel.id;
    this._getCanvas = getCanvas;
  }

  //to fix, there should not be canvas ref
  CanvasObjectLoadToken({ id }) {
    const canvas = this._getCanvas();
    const object = canvas.getObjects().find((x) => x.id === id);

    //Create additional objects dependencies
    if (object.tokenUiElements) {
      fabric.util.enlivenObjects(object.tokenUiElements, (e) => {
        e.forEach((element) => {
          if (element?.tokenData?.showOnTokenControl) {
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

        this.UpdateTokenBasedOnProperties({ tokenId: id });
      });
    }
  }

  UpdateTokensPropertySpecific({
    propertyName,
    source,
    propertyValue,
    isCommand,
    property,
  }) {
    if (isCommand && (!propertyName || !propertyValue || !source)) {
      return "--source --propertyValue and --propertyName are required";
    }

    let finalProperty = property;

    if (!finalProperty) {
      finalProperty = {
        name: propertyName,
        value: propertyValue,
        entityName: source,
      };
    }

    const canvas = this._getCanvas();
    const objects = canvas.getObjects().filter((x) => {
      if(!x.properties) {
        return false;
      }
      const isToken = UtilityHelper.ParseBool(x?.properties["isToken"]?.value);
      return isToken;
    });

    objects.forEach((object) => {
      this.UpdateTokenBasedOnProperties({
        tokenId: object.id,
        property: finalProperty,
      });
    });
  }

  async UpdateTokenPropertySpecific({
    tokenId,
    propertyName,
    source,
    propertyValue,
    isCommand,
    property,
  }) {
    if (isCommand && (!tokenId || !propertyName || !propertyValue || !source)) {
      return "--tokenId, --source --propertyValue and --propertyName are required";
    }

    let finalProperty = property;

    if (!finalProperty) {
      finalProperty = {
        name: propertyName,
        value: propertyValue,
        entityName: source,
      };
    }

    const canvas = this._getCanvas();
    const object = canvas.getObjects().find((x) => x.id === tokenId);

    if (!object) {
      return;
    }

    let objectPropDeps = object.tokenData?.propDeps.filter(
      (x) =>
        x.dtoProperty === finalProperty.name &&
        finalProperty.entityName.toLowerCase().startsWith(x.source)
    );
    if (objectPropDeps.length > 0) {
      objectPropDeps.forEach((x) =>
        this._handleDep(x, object, object, [finalProperty])
      );
    }

    if (object.additionalObjects) {
      object.additionalObjects.forEach((element) => {
        let elementPropDeps = element.tokenData?.propDeps.filter(
          (x) =>
            x.dtoProperty === finalProperty.name &&
            finalProperty.entityName.toLowerCase().startsWith(x.source)
        );
        if (elementPropDeps.length > 0) {
          elementPropDeps.forEach((x) =>
            this._handleDep(x, object, element, [finalProperty])
          );
        }
      });
    }
  }

  _handleDep(
    { dtoProperty, objectProperty, rule, type, source },
    object,
    targetElement,
    properties
  ) {
    let propValue = properties.find(
      (x) =>
        x.name === dtoProperty &&
        x.entityName?.toLowerCase()?.startsWith(source)
    )?.value;

    if (propValue === undefined) {
      console.warn(`Property ${dtoProperty} not found on object ${object.id}`);
      return;
    }

    if (type === "bool") {
      propValue = UtilityHelper.ParseBool(propValue);
    }

    if (type === "number") {
      propValue = parseFloat(propValue);
    }

    //ignore rules for now
    if (!rule) {
      targetElement[objectProperty] = propValue;
    }
  }

  UpdateTokenBasedOnProperties({ tokenId, isCommand }) {
    const handleDeps = async (object, targetElement, propDeps) => {
      if (!propDeps) {
        return;
      }

      const grouped = Object.groupBy(propDeps, (x) => x.source);
      const results = await Promise.all(
        Object.keys(grouped).map(async (sourceKey) => {
          const sourceGroup = grouped[sourceKey];
          const source = sourceKey;
          let properties = [];
          const propNames = sourceGroup.map((x) => x.dtoProperty);
          let parentId = null;

          switch (source) {
            case "element":
              properties = Object.values(object.properties);
              break;
            case "card":
              parentId = object?.tokenData?.cardId;
              break;
            case "map":
              parentId = ClientMediator.sendCommand(
                "Battlemap",
                "GetSelectedMap",
                { contextId: this.contextId }
              )?.id;
              break;
            case "game":
              parentId = ClientMediator.sendCommand("Game", "GetGame")?.id;
              break;
          }

          if (parentId && propNames) {
            properties = await ClientMediator.sendCommandAsync(
              "Properties",
              "GetByNames",
              { parentId: parentId, names: propNames }
            );
          }

          return properties;
        })
      );

      const allProperties = results.flat();
      propDeps?.forEach((x) =>
        this._handleDep(x, object, targetElement, allProperties)
      );

      canvas.requestRenderAll();
    };

    if (isCommand && !tokenId) {
      return "--tokenId is required";
    }

    const canvas = this._getCanvas();
    const object = canvas.getObjects().find((x) => x.id === tokenId);

    if (object.tokenData?.propDeps) {
      handleDeps(object, object, object.tokenData?.propDeps);
    }

    if (object.additionalObjects) {
      object.additionalObjects.forEach((element) => {
        element.enabled = UtilityHelper.ParseBool(
          object.properties["show_" + element.name]?.value
        );
        element.visible = !(element.enabled === false);
        if (!element.visible) {
          return;
        }

        handleDeps(object, element, element.tokenData?.propDeps);
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

    this._CreateToken(cardId, position);
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

    const properties = await ClientMediator.sendCommandAsync(
      "Properties",
      "GetByNames",
      { parentId: cardId, names }
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
        tokenData: { ...token.tokenData, cardId },
        isToken: true,
        tokenUiElements: token.additions,
        mapId: map.id,
        layer: 100,
        src: tokenImageId,
      });

      let calculatedSize = gridSize * (tokenSize ?? token.size);
      object.scaleToWidth(calculatedSize);

      token.additions.forEach((element) => {
        if (element?.tokenData?.ignoreRelativePosition) {
          return;
        }

        // set relative position
        if (element.top > 0) {
          element.top = element.top - gridSize + calculatedSize;
        }

        if (element.left > 0) {
          element.left = element.left - gridSize + calculatedSize;
        }
      });

      var dto = DTOConverter.ConvertToDTO(object);
      WebSocketManagerInstance.Send({
        command: "element_add",
        data: {
          ...dto,
          properties: [
            { name: "isToken", value: "true" },
            { name: "cardId", value: cardId },
            { name: "player_owner", value: playerOwner },
            { name: "tokenSize", value: tokenSize },
          ],
          withSelection: true,
        },
      });
    });
  }
}

export default TokenManager;
