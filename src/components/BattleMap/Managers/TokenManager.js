import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import { fabric } from "fabric";
import DTOConverter from "../DTOConverter";
import ClientMediator from "../../../ClientMediator";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import UtilityHelper from "../../../helpers/UtilityHelper";
import TokenUIRules from "../../../helpers/TokenUIRules";
import { extractPropNames, isExpressionDep, evaluate } from "../../../helpers/TokenExpressionEvaluator";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_LAYER = 100;
const TOKEN_UI_LAYER = 110;

/** Property names fetched when spawning a new token */
const CREATE_TOKEN_PROPS = [
  "token",
  "tokenImage",
  "drop_token_size",
  "character_name",
  "player_owner",
];

/** The implicit propDep injected into every token (card image → fabric src) */
const IMAGE_PROP_DEP = Object.freeze({
  dtoProperty: "tokenImage",
  objectProperty: "src",
  type: "string",
  source: "card",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely find a property value by name, returning `fallback` when missing. */
const findPropValue = (properties, name, fallback = undefined) =>
  properties.find((p) => p.name === name)?.value ?? fallback;

/**
 * Coerce a raw string value to the declared dep type.
 * Returns `undefined` when coercion is impossible.
 */
const coerceValue = (raw, type) => {
  switch (type) {
    case "bool":
      return UtilityHelper.ParseBool(raw);
    case "number": {
      const n = parseFloat(raw);
      return Number.isNaN(n) ? undefined : n;
    }
    case "string":
    default:
      return raw;
  }
};

// ─── TokenManager ─────────────────────────────────────────────────────────────

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

  // ── $meta ─────────────────────────────────────────────────────────────────
  get $meta() {
    return {
      CanvasObjectLoadToken: {
        description:
          "Enlives and attaches token UI elements for an already-loaded canvas object.",
        args: [{ name: "id", type: "string", required: true }],
      },
      UpdateTokensPropertySpecific: {
        description:
          "Updates a named property on every token on the canvas that has a matching prop-dep.",
        args: [
          { name: "propertyName", type: "string", required: true },
          { name: "source", type: "string", required: true },
          { name: "propertyValue", type: "string", required: true },
        ],
      },
      UpdateTokenPropertySpecific: {
        description:
          "Updates a named property on a single token identified by its canvas object ID.",
        args: [
          { name: "tokenId", type: "string", required: true },
          { name: "propertyName", type: "string", required: true },
          { name: "source", type: "string", required: true },
          { name: "propertyValue", type: "string", required: true },
        ],
      },
      UpdateTokenBasedOnProperties: {
        description:
          "Re-fetches all property dependencies for a token and re-applies them to the canvas object.",
        args: [{ name: "tokenId", type: "string", required: true }],
      },
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
          "Spawns a new token on the map from a card ID at the given position.",
        args: [
          { name: "cardId", type: "string", required: true },
          { name: "x", type: "number", required: false },
          { name: "y", type: "number", required: false },
        ],
      },
      UpdateTokenUIPositions: {
        description:
          "Recalculates and repositions all additional UI objects anchored to a token.",
        args: [{ name: "objectId", type: "string", required: true }],
      },
    };
  }

  // ── Canvas helpers ────────────────────────────────────────────────────────

  /** Find a single canvas object by id, or `undefined`. */
  _findObject(id) {
    return this._getCanvas()
      .getObjects()
      .find((o) => o.id === id);
  }

  /** Return all canvas objects that are tokens. */
  _allTokens() {
    return this._getCanvas()
      .getObjects()
      .filter((o) => o.tokenData != null);
  }

  // ── Map / game context shortcuts ──────────────────────────────────────────

  _getSelectedMap() {
    return ClientMediator.sendCommand("BattleMap", "GetSelectedMap", {
      contextId: this.contextId,
    });
  }

  _getGameId() {
    return ClientMediator.sendCommand("Game", "GetGameId");
  }

  // ── Resolve the parentId for a given source key ───────────────────────────

  _resolveParentId(source, object) {
    switch (source) {
      case "element":
        return object.id;
      case "card":
        return object?.tokenData?.cardId;
      case "map":
        return this._getSelectedMap()?.id;
      case "game":
        return this._getGameId();
      default:
        console.warn(`TokenManager: unknown property source "${source}"`);
        return null;
    }
  }

  // ── Core: apply a single property dependency ─────────────────────────────

  /**
   * Reads the matching property value from `properties`, coerces it,
   * optionally runs a rule transform, and applies it to `targetElement`.
   *
   * @returns {boolean} true if the element was mutated
   */
  _applyDep(dep, object, targetElement, properties) {
    const { objectProperty, type, source } = dep;

    let value;

    // Expression syntax: %propName% substitution + rule function calls
    if (isExpressionDep(dep)) {
      const refNames = extractPropNames(dep.expression);
      const propsMap = new Map();
      for (const name of refNames) {
        const prop = properties.find(
          (p) => p.name === name && (!p.entityName || p.entityName.toLowerCase().startsWith(source))
        );
        if (prop !== undefined) propsMap.set(name, prop.value);
      }
      value = evaluate(dep.expression, propsMap, type);
      if (value === undefined) {
        console.warn(
          `TokenManager: expression "${dep.expression}" evaluated to undefined on ${object.id}`
        );
        return false;
      }
    } else {
      const { dtoProperty, rule } = dep;

      const raw = properties.find(
        (p) =>
          p.name === dtoProperty &&
          (!p.entityName || p.entityName.toLowerCase().startsWith(source))
      )?.value;

      if (raw === undefined) {
        return false;
      }

      value = coerceValue(raw, type);
      if (value === undefined) {
        console.warn(
          `TokenManager: could not coerce "${raw}" to ${type} for dep ${dtoProperty} on ${object.id}`
        );
        return false;
      }

      // Optional rule transform (e.g. percentage → pixel width)
      if (rule) {
        if (!rule.name || !TokenUIRules[rule.name]) {
          console.warn(
            `TokenManager: unknown rule "${rule?.name}" on object ${object.id}`
          );
          return false;
        }

        // Resolve propTargetMin / propTargetMax: if the rule argument is a string
        // treat it as a property name, look it up in the already-fetched properties
        // (same source filter as dtoProperty), and convert to a number.
        const ruleArgs = { ...rule.arguments, value };
        const { propTargetMin, propTargetMax } = rule.arguments ?? {};

        if (typeof propTargetMin === "string") {
          const prop = properties.find(
            (p) => p.name === propTargetMin &&
                   (!p.entityName || p.entityName.toLowerCase().startsWith(source))
          );
          const n = parseFloat(prop?.value);
          ruleArgs.propTargetMin = Number.isNaN(n) ? undefined : n;
        }
        if (typeof propTargetMax === "string") {
          const prop = properties.find(
            (p) => p.name === propTargetMax &&
                   (!p.entityName || p.entityName.toLowerCase().startsWith(source))
          );
          const n = parseFloat(prop?.value);
          ruleArgs.propTargetMax = Number.isNaN(n) ? undefined : n;
        }

        value = TokenUIRules[rule.name](ruleArgs);
      }
    } // end legacy path

    // Fabric crashes with a 0×0 cache canvas — clamp width/height to at least 1px.
    if ((objectProperty === "width" || objectProperty === "height") && typeof value === "number") {
      value = Math.max(value, 1);
    }

    // Special case: image src must be a full resource URL so FabricTypesInitializer
    // can intercept it and fetch via WebRTC.  A raw UUID (no slashes) needs to be
    // converted, and fabric.Image needs setSrc() — not just set() — to actually
    // reload the displayed image.
    if (objectProperty === "src") {
      const url =
        typeof value === "string" && !value.includes("/")
          ? WebHelper.getResourceString(value)
          : value;
      targetElement.set("src", url);
      if (typeof targetElement.setSrc === "function") {
        targetElement.setSrc(url, () => {});
      }
      return true;
    }

    targetElement.set(objectProperty, value);
    return true;
  }

  // ── Prop-ref helpers ─────────────────────────────────────────────────────

  /**
   * Returns the property names referenced inside rule arguments
   * (propTargetMin / propTargetMax) for a list of deps so they can be
   * included in the same batch fetch as each dep's own dtoProperty.
   */
  _propRefNames(deps) {
    const names = [];
    for (const dep of deps) {
      if (isExpressionDep(dep)) {
        names.push(...extractPropNames(dep.expression));
      } else {
        const args = dep.rule?.arguments;
        if (!args) continue;
        if (typeof args.propTargetMin === "string") names.push(args.propTargetMin);
        if (typeof args.propTargetMax === "string") names.push(args.propTargetMax);
      }
    }
    return names;
  }

  // ── Core: batch-fetch properties for a set of deps ────────────────────────

  /**
   * Groups deps by source, resolves each source's parentId, fetches all
   * needed property names in one call per source, then applies every dep.
   * Prop-ref names (propTargetMin / propTargetMax on FromTo rules) are
   * included in the fetch so _applyDep can resolve them without an extra
   * round-trip.
   *
   * @returns {Promise<boolean>} true if any element was mutated
   */
  async _fetchAndApplyDeps(object, targetElement, propDeps) {
    if (!propDeps?.length) return false;

    // Group by source → { element: [dep, dep], card: [dep], … }
    const grouped = propDeps.reduce((acc, d) => {
      (acc[d.source] ??= []).push(d);
      return acc;
    }, {});

    // One fetch per source (parallelised)
    const fetches = Object.entries(grouped).map(async ([source, deps]) => {
      const parentId = this._resolveParentId(source, object);
      if (!parentId) return [];

      const names = [...new Set([
        ...deps.filter((d) => !isExpressionDep(d)).map((d) => d.dtoProperty),
        ...this._propRefNames(deps),
      ])];
      try {
        return await ClientMediator.sendCommandAsync(
          "Properties",
          "GetByNames",
          { parentId, names }
        );
      } catch (err) {
        console.error(
          `TokenManager: failed to fetch props [${names}] for source "${source}"`,
          err
        );
        return [];
      }
    });

    const allProperties = (await Promise.all(fetches)).flat();

    let mutated = false;
    for (const dep of propDeps) {
      if (this._applyDep(dep, object, targetElement, allProperties)) {
        mutated = true;
      }
    }
    return mutated;
  }

  // ── Apply a single property to a token and its UI elements ────────────────

  /**
   * Shared by UpdateTokensPropertySpecific & UpdateTokenPropertySpecific.
   * Applies a single property change without a full re-fetch.
   * If any matching dep has propTargetMin / propTargetMax prop-refs, those
   * are fetched in one batch per source before applying.
   */
  async _applySinglePropertyToToken(object, property) {
    const canvas = this._getCanvas();
    let mutated = false;

    // Collect every (target element, dep) pair that matches the changed property
    const work = []; // [{ target, dep }]

    const matchesDep = (d) => {
      if (property.entityName && !property.entityName.toLowerCase().startsWith(d.source)) return false;
      if (isExpressionDep(d)) return extractPropNames(d.expression).includes(property.name);
      return d.dtoProperty === property.name;
    };

    for (const dep of object.tokenData?.propDeps?.filter(matchesDep) ?? []) {
      work.push({ target: object, dep });
    }
    for (const element of object.additionalObjects ?? []) {
      for (const dep of element.tokenData?.propDeps?.filter(matchesDep) ?? []) {
        work.push({ target: element, dep });
      }
    }

    if (!work.length) return;

    // Fetch any prop-ref names required by the matched deps (one batch per source),
    // excluding the already-available changed property.
    const refNames = this._propRefNames(work.map((w) => w.dep))
      .filter((n) => n !== property.name);
    let properties = [property];

    if (refNames.length) {
      const source = work[0].dep.source; // all matched deps share the same source
      const parentId = this._resolveParentId(source, object);
      if (parentId) {
        try {
          const fetched = await ClientMediator.sendCommandAsync(
            "Properties",
            "GetByNames",
            { parentId, names: refNames }
          );
          properties = [property, ...(fetched ?? [])];
        } catch (err) {
          console.error(
            `TokenManager: failed to fetch prop-refs [${refNames}] for source "${source}"`,
            err
          );
        }
      }
    }

    for (const { target, dep } of work) {
      if (this._applyDep(dep, object, target, properties)) mutated = true;
    }

    if (mutated) {
      canvas.requestRenderAll();
    }
  }

  // ── Public commands ─────────────────────────────────────────────────────

  /**
   * Enliven and attach token UI elements for an already-loaded canvas object.
   */
  CanvasObjectLoadToken({ id }) {
    const canvas = this._getCanvas();
    const object = this._findObject(id);

    if (!object) {
      console.warn(
        `TokenManager.CanvasObjectLoadToken: object "${id}" not found`
      );
      return;
    }

    if (!object.tokenUiElements?.length) return;

    fabric.util.enlivenObjects(object.tokenUiElements, (enlivened) => {
      object.additionalObjects = object.additionalObjects || [];

      enlivened.forEach((element) => {
        // Layer & selectability
        element.layer = TOKEN_UI_LAYER;
        element.selectable = false;
        element.isTokenUI = true;

        // Hide every element until deps are applied — prevents Fabric from
        // trying to cache a 0-dimension element (e.g. text with empty string).
        element.visible = false;

        // Editable i-text: enter editing on double-click, exit on click-away
        if (element.type === "i-text" && element.editable) {
          element.on("mousedblclick", (e) => {
            e.target.enterEditing();
            e.target.selectAll();
            const exitHandler = () => {
              e.target.exitEditing();
              canvas.off("mouse:down", exitHandler);
            };
            canvas.on("mouse:down", exitHandler);
          });
        }

        object.additionalObjects.push(element);
        canvas.add(element);
      });

      this.UpdateTokenUIPositions({ object });
      // UpdateTokenBasedOnProperties restores visibility after applying deps
      this.UpdateTokenBasedOnProperties({ tokenId: id });
    });
  }

  /**
   * Update a named property on EVERY token that has a matching prop-dep.
   */
  UpdateTokensPropertySpecific({
    propertyName,
    source,
    propertyValue,
    isCommand,
    property,
  }) {
    if (isCommand && (!propertyName || !propertyValue || !source)) {
      return "--source, --propertyValue and --propertyName are required";
    }

    const finalProperty = property ?? {
      name: propertyName,
      value: propertyValue,
      entityName: source,
    };

    const tokens = this._allTokens();
    for (const token of tokens) {
      this._applySinglePropertyToToken(token, finalProperty).catch((err) =>
        console.error("TokenManager: _applySinglePropertyToToken failed", err)
      );
    }
  }

  /**
   * Update a named property on a SINGLE token.
   */
  UpdateTokenPropertySpecific({
    tokenId,
    propertyName,
    source,
    propertyValue,
    isCommand,
    property,
  }) {
    if (isCommand && (!tokenId || !propertyName || !propertyValue || !source)) {
      return "--tokenId, --source, --propertyValue and --propertyName are required";
    }

    const object = this._findObject(tokenId);
    if (!object) return;

    const finalProperty = property ?? {
      name: propertyName,
      value: propertyValue,
      entityName: source,
    };

    this._applySinglePropertyToToken(object, finalProperty).catch((err) =>
      console.error("TokenManager: _applySinglePropertyToToken failed", err)
    );
  }

  /**
   * Re-fetch ALL property dependencies for a token and re-apply them.
   */
  async UpdateTokenBasedOnProperties({ tokenId, isCommand }) {
    if (isCommand && !tokenId) {
      return "--tokenId is required";
    }

    const canvas = this._getCanvas();
    const object = this._findObject(tokenId);

    if (!object) {
      console.warn(
        `TokenManager.UpdateTokenBasedOnProperties: object "${tokenId}" not found`
      );
      return;
    }

    let mutated = false;

    // Token object's own deps
    if (
      await this._fetchAndApplyDeps(object, object, object.tokenData?.propDeps)
    ) {
      mutated = true;
    }

    // Additional UI elements
    if (object.additionalObjects) {
      for (const element of object.additionalObjects) {
        // Restore visibility: hidden if disabled or control-only
        element.visible = element.enabled !== false &&
          !element.tokenData?.showOnTokenControl;
        if (!element.visible) continue;

        if (
          await this._fetchAndApplyDeps(
            object,
            element,
            element.tokenData?.propDeps
          )
        ) {
          mutated = true;
        }
      }
    }

    // Single render call after all deps are resolved
    if (mutated) {
      canvas.requestRenderAll();
    }
  }

  // ── Query commands ──────────────────────────────────────────────────────

  async IsToken({ objectId, id, isCommand }) {
    if (isCommand && !id) return "--id is required";

    const result = await ClientMediator.sendCommandAsync(
      "Properties",
      "GetByNames",
      { parentId: id ?? objectId, names: ["isToken"] }
    );
    return UtilityHelper.ParseBool(result?.[0]?.value ?? false);
  }

  async GetTokenCardID({ objectId, id, isCommand }) {
    if (isCommand && !id) return "--id is required";

    const result = await ClientMediator.sendCommandAsync(
      "Properties",
      "GetByNames",
      { parentId: id ?? objectId, names: ["cardId"] }
    );
    return result?.[0]?.value;
  }

  // ── Token creation ──────────────────────────────────────────────────────

  CreateToken({ cardId, position, x, y, isCommand }) {
    if (isCommand && !cardId) return "--cardId is required";

    // Normalise position — use explicit x/y from command, or the provided object
    const pos = isCommand
      ? { x: parseFloat(x) || 0, y: parseFloat(y) || 0 }
      : { x: position?.x ?? 0, y: position?.y ?? 0 };

    this._createTokenAsync(cardId, pos);
  }

  /**
   * Internal: fetch token definition + card properties, build the Fabric
   * object, and send the element_add command via WebSocket.
   */
  async _createTokenAsync(cardId, position) {
    const map = this._getSelectedMap();
    if (!map) {
      console.error("TokenManager._createTokenAsync: no map selected");
      return;
    }

    const { gridSize } = map;

    // Fetch card properties
    const properties = await ClientMediator.sendCommandAsync(
      "Properties",
      "GetByNames",
      { parentId: cardId, names: CREATE_TOKEN_PROPS }
    );

    const tokenId = findPropValue(properties, "token");
    if (!tokenId) {
      console.error(
        `TokenManager._createTokenAsync: no "token" property found for card "${cardId}"`
      );
      return;
    }

    const characterName = findPropValue(properties, "character_name", "Token");
    const tokenSize =
      parseInt(findPropValue(properties, "drop_token_size", "1"), 10) || 1;
    const tokenImageId = findPropValue(properties, "tokenImage");

    // Fetch the token JSON template
    const tokenRaw = await WebHelper.getMaterialAsync(
      tokenId,
      "application/json"
    );
    if (!tokenRaw) {
      console.error(
        `TokenManager._createTokenAsync: failed to fetch token template "${tokenId}"`
      );
      return;
    }

    const token = JSON.parse(tokenRaw);

    // Convert the raw resource ID to a full URL so fabric.util.loadImage
    // recognises it as a backend resource and fetches it via WebRTC.
    const tokenImageUrl = tokenImageId
      ? WebHelper.getResourceString(tokenImageId)
      : undefined;

    // Build the Fabric image object
    fabric.Image.fromURL(tokenImageUrl, (fabricObject) => {
      fabricObject.set({
        ...token.object,
        name: `${token.prefix ?? "token"} ${characterName}`,
        left: position.x,
        top: position.y,
        cardId: cardId,
        tokenData: {
          ...token?.tokenData,
          cardId,
          propDeps: [
            ...(token?.tokenData?.propDeps ?? []),
            IMAGE_PROP_DEP,
          ],
        },
        isToken: true,
        tokenUiElements: token.additions,
        mapId: map.id,
        layer: TOKEN_LAYER,
        // resourceId is preserved through the DTO round-trip (ConvertToDTO strips
        // src but keeps other fields); ConvertFromDTO rebuilds src from resourceId.
        resourceId: tokenImageId,
        src: tokenImageUrl,
      });

      fabricObject.scaleToWidth(gridSize * tokenSize);

      // Position UI elements relative to the token
      this.UpdateTokenUIPositions({ object: fabricObject });

      // Set UI element layers
      fabricObject.tokenUiElements?.forEach((el) => {
        el.layer = TOKEN_UI_LAYER;
      });

      // Send to server
      const dto = DTOConverter.ConvertToDTO(fabricObject);
      WebSocketManagerInstance.Send({
        command: "element_add",
        data: {
          ...dto,
          withSelection: true,
          properties: [
            { name: "tokenSize", value: String(tokenSize) },
            { name: "isToken", value: "true" },
          ],
        },
      });
    });
  }

  // ── UI positioning ──────────────────────────────────────────────────────

  /**
   * Recalculate and reposition all additional UI objects anchored to a token.
   */
  UpdateTokenUIPositions({ object, objectId, isCommand }) {
    if (isCommand && !objectId) return "--objectId is required";

    const canvas = this._getCanvas();
    let token = object;

    if (!token && objectId) {
      token = this._findObject(objectId);
    }

    if (!token) {
      console.warn("TokenManager.UpdateTokenUIPositions: token not found");
      return;
    }

    if (!token.additionalObjects?.length) return;

    const map = this._getSelectedMap();
    if (!map?.gridSize) return;

    const { gridSize } = map;
    const center = token.getCenterPoint();
    const gridSizeScale = gridSize / token.width;
    const currentScale = token.scaleX;
    const expectedSize = gridSize * (currentScale / gridSizeScale);
    const halfSize = expectedSize / 2;
    const zero = {
      x: center.x - halfSize,
      y: center.y - halfSize,
    };

    for (const element of token.additionalObjects) {
      if (element?.tokenData?.ignoreRelativePosition) continue;

      const oX = element.tokenData?.offsetX ?? 0;
      const oY = element.tokenData?.offsetY ?? 0;

      switch (element.tokenData?.anchor) {
        case "top":
          element.left = zero.x + halfSize + oX;
          element.top = zero.y + oY;
          break;
        case "bottom":
          element.left = center.x + oX;
          element.top = zero.y + expectedSize + oY;
          break;
        case "left":
          element.left = zero.x + oX;
          element.top = zero.y + halfSize + oY;
          break;
        case "right":
          element.left = zero.x + expectedSize + oX;
          element.top = zero.y + halfSize + oY;
          break;
        case "right-top":
          element.left = zero.x + expectedSize + oX;
          element.top = zero.y + oY;
          break;
        case "left-bottom":
          element.left = zero.x + oX;
          element.top = zero.y + expectedSize + oY;
          break;
        case "right-bottom":
          element.left = zero.x + expectedSize + oX;
          element.top = zero.y + expectedSize + oY;
          break;
        case "center":
          element.left = zero.x + halfSize + oX;
          element.top = zero.y + halfSize + oY;
          break;
        case "left-top":
        default:
          element.left = zero.x + oX;
          element.top = zero.y + oY;
          break;
      }
    }

    // Single render call AFTER all repositioning
    canvas.requestRenderAll();
  }
}

export default TokenManager;