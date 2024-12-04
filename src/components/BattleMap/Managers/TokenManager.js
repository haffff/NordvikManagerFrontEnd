import WebSocketManagerInstance from "../../game/WebSocketManager";
import { fabric } from "fabric";
import DTOConverter from "../DTOConverter";
import ClientMediator from "../../../ClientMediator";
import WebHelper from "../../../helpers/WebHelper";
import UtilityHelper from "../../../helpers/UtilityHelper";
import TokenUIRules from "../../../helpers/TokenUIRules";

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

  _originalBoundingWidth = undefined;

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
          element.layer = 110;
          element.selectable = false;
          element.isTokenUI = true;

          if(element.tokenData?.showOnTokenControl)
          {
            element.visible = false;
          }

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

        this.UpdateTokenUIPositions({ object });
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
      if (!x.properties) {
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

    if (rule) {
      if(rule.name === null)
      {
        console.warn(`Rule ${rule.name} not found on object ${object.id}`);
        return;
      }

      propValue = TokenUIRules[rule.name]({
        ...rule.arguments,
        value: propValue,
      });
    }

    targetElement[objectProperty] = propValue;
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
    )?.value ?? "Token";
    const tokenSize = properties.find(
      (p) => p.name === "drop_token_size"
    )?.value ?? 1;

    const tokenRaw = await WebHelper.getMaterialAsync(
      tokenId,
      "application/json"
    );
    const tokenImageId = properties.find((p) => p.name === "tokenImage").value;

    const token = JSON.parse(tokenRaw);

    const fabricObject = fabric.Image.fromURL(tokenImageId, (object) => {
      object.set({
        ...token.object,
        name: token.prefix + " " + characterName,
        left: position.x,
        top: position.y,
        cardId: cardId,
        tokenData: {
          ...token?.tokenData,
          cardId,
          propDeps: [
            ...(token?.tokenData?.propDeps ?? []),
            {
              dtoProperty: "tokenSize",
              objectProperty: "scaleX",
              type: "number",
              source: "card",
            },
            {
              dtoProperty: "tokenImage",
              objectProperty: "src",
              type: "string",
              source: "card",
            },
          ],
        },
        isToken: true,
        tokenUiElements: token.additions,
        mapId: map.id,
        layer: 100,
        src: tokenImageId,
      });

      object.scaleToWidth(gridSize * tokenSize);

      this.UpdateTokenUIPositions(object);

      object.tokenUiElements?.forEach((element) => {
        element.layer = 110;
      });

      var dto = DTOConverter.ConvertToDTO(object);
      WebSocketManagerInstance.Send({
        command: "element_add",
        data: {
          ...dto,
          properties: [
            { name: "isToken", value: "true" },
            { name: "cardId", value: cardId }
          ],
          withSelection: true,
        },
      });
    });
  }

  async UpdateTokenUIPositions({ object, objectId, isCommand }) {
    if (isCommand && !objectId) {
      return "--objectId is required";
    }

    const canvas = this._getCanvas();
    let token = object;
    if (!token && objectId) {
      token = canvas.getObjects().find((x) => x.id === objectId);
    }

    const parentId = token?.tokenData?.cardId;
    if (!parentId) {
      return;
    }

    // const tokenSize = ClientMediator.sendCommandAsync(
    //   "Properties",
    //   "GetByNames",
    //   { contextId: this.contextId, parentId: parentId, names: ["tokenSize"] }
    // );

    const { gridSize } = ClientMediator.sendCommand(
      "BattleMap",
      "GetSelectedMap",
      {
        contextId: this.contextId,
      }
    );

    const center = object.getCenterPoint();

    const boundingRectFactor = 1;
    //token.getBoundingRect().width / token.getScaledWidth();
    const gridSizeScale = gridSize / token.width / boundingRectFactor;
    const currentScale = token.scaleX;

    console.log("getBoundingRectFactor", boundingRectFactor);
    //const zeroCenter = object.getPointByOrigin("center", "center");
    
    const expectedAdditonalOffset = gridSize * (currentScale / gridSizeScale);
    const expectedCenter = expectedAdditonalOffset / 2;
    const zero = {x: center.x - expectedCenter , y: center.y  - expectedCenter};

    token.additionalObjects.forEach((element) => {
      if (element?.tokenData?.ignoreRelativePosition) {
        return;
      }

      const offsetY = element?.tokenData?.offsetY ?? 0;
      const offsetX = element.tokenData?.offsetX ?? 0;

      switch (element.tokenData?.anchor) {
        case "top":
          element.top = zero.y + offsetY;
          element.left = zero.x + offsetX + expectedCenter;
          break;
        case "bottom":
          element.top = zero.y + expectedAdditonalOffset + offsetY;
          element.left = center.x + offsetX;
          break;
        case "left":
          element.top = zero.y + offsetY + expectedCenter;
          element.left = zero.x + offsetX;
          break;
        case "right":
          element.top = expectedCenter + offsetY;
          element.left = zero.x + expectedAdditonalOffset + offsetX;
          break;
        case "left-top":
        default:
          element.top = zero.y + offsetY;
          element.left = zero.x + offsetX;
          break;
        case "right-top":
          element.top = zero.y + offsetY;
          element.left = zero.x + expectedAdditonalOffset + offsetX;
          break;
        case "left-bottom":
          element.top = zero.y + expectedAdditonalOffset + offsetY;
          element.left = zero.x + offsetX;
          break;
        case "right-bottom":
          element.top = zero.y + expectedAdditonalOffset + offsetY;
          element.left = zero.x + expectedAdditonalOffset + offsetX;
          break;
        case "center":
          element.top = expectedCenter + offsetY;
          element.left = expectedCenter + offsetX;
          break;
      }

      canvas.requestRenderAll();
    });
  }
}

export default TokenManager;
