import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import { fabric } from "fabric";
import DTOConverter from "../DTOConverter";
import ClientMediator from "../../../ClientMediator";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import UtilityHelper from "../../../helpers/UtilityHelper";
import TokenUIRules from "../../../helpers/TokenUIRules";
import { extractPropNames, isExpressionDep, evaluate } from "../../../helpers/TokenExpressionEvaluator";
import { SYSTEM_ASSET_KEYS } from "../../../helpers/systemAssets";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RESERVED_LAYERS } from "../Constants/layers";
import { ICON_PACK_LOADERS } from "../../../helpers/ReactIconPackLoaders";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_LAYER = RESERVED_LAYERS.TOKEN;
const TOKEN_UI_LAYER = RESERVED_LAYERS.TOKEN_UI;

/** Property names fetched when spawning a new token */
const CREATE_TOKEN_PROPS = [
  "token",
  "tokenImage",
  "drop_token_size",
  "character_name",
  "player_owner",
];

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true if value is a bare GUID, false if it's a named/scoped key. */
const _isGuid = (value) => GUID_RE.test(value ?? "");

/**
 * Convert a raw resource reference to a full URL for fabric.js / img src use.
 *  - GUID       → ?id=<uuid>
 *  - Any other string (named key, scoped key) → ?key=<value>
 *  - Already a full URL → returned as-is
 */
function _toResourceUrl(value) {
  if (!value || typeof value !== "string") return value;
  if (value.startsWith("http") || value.startsWith("/")) return value;
  return _isGuid(value)
    ? WebHelper.getResourceString(value)
    : WebHelper.getResourceString(null, value);
}

/**
 * Fetch a material by id-or-key, routing correctly to ?id= or ?key=.
 */
function _getMaterial(idOrKey, mimeType) {
  return _isGuid(idOrKey)
    ? WebHelper.getMaterialAsync(idOrKey, mimeType)
    : WebHelper.getMaterialAsync(null, mimeType, idOrKey);
}

/** The implicit propDep injected into every token (card image → fabric src) */
const IMAGE_PROP_DEP = Object.freeze({
  dtoProperty: "tokenImage",
  objectProperty: "src",
  type: "string",
  source: "card",
});

/**
 * Maps tokenData.actions keys to Fabric.js per-object event names.
 *
 * IMPORTANT: `onClick` is intentionally absent here.
 * Fabric.js 5.x does not reliably fire `mouseup` on non-selectable objects.
 * `onClick` is handled at the canvas level via OnTokenUIActionClickBehavior
 * so it always fires regardless of selectability.
 *
 * Add entries here only for events that Fabric reliably fires per-object.
 */
const TOKEN_UI_EVENT_MAP = Object.freeze({
  onDblClick:   "mousedblclick",  // canvas fires this reliably per-object
  onHover:      "mouseover",
  onHoverEnd:   "mouseout",
  onRightClick: "mousedown",      // filtered to button === 2 at wire-up time
  onMouseDown:  "mousedown",
});

/** Action keys whose cursor should become a pointer on hover. */
const POINTER_CURSOR_ACTIONS = new Set(["onClick", "onDblClick", "onRightClick"]);

/**
 * ClientMediator panel.command pairs that token UI elements are allowed to call.
 *
 * Security note: token JSON is authored by developers/GM and runs in the trusted
 * client context, but this allowlist prevents a compromised or malicious token
 * template from calling destructive commands (DeleteGame, DeleteAllElements, etc.).
 *
 * Extend this list when new commands are needed by token UI.
 * Format: "Panel.Command": true
 */
const ALLOWED_TOKEN_UI_MEDIATOR_COMMANDS = Object.freeze({
  // ── Panels ─────────────────────────────────────────────────────────────
  "Game.CreateNewPanel":     true,   // open card panel, custom panels, etc.

  // ── Read-only game state ────────────────────────────────────────────────
  "Game.GetPlayers":         true,
  "Game.GetCurrentPlayer":   true,
  "Game.GetGameId":          true,
  "Game.GetIsGM":            true,

  // ── Map ─────────────────────────────────────────────────────────────────
  "BattleMap.GetSelectedMap": true,

  // ── Properties (status set/clear, etc.) ─────────────────────────────────
  "Properties.GetByNames":   true,
  "Properties.GetProperties": true,
  "Properties.Add":          true,
  "Properties.Update":       true,
  "Properties.Remove":       true,

  // ── Chat ─────────────────────────────────────────────────────────────────
  "Chat.SendMessage":        true,
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
          "Spawns a new token on the map at the given position, for a card (cardId) or, with no card, from a token definition (token: its resource key or id; image: optional).",
        args: [
          { name: "cardId", type: "string", required: false },
          { name: "token", type: "string", required: false },
          { name: "image", type: "string", required: false },
          { name: "x", type: "number", required: false },
          { name: "y", type: "number", required: false },
        ],
      },
      UpdateTokenUIPositions: {
        description:
          "Recalculates and repositions all additional UI objects anchored to a token.",
        args: [{ name: "objectId", type: "string", required: true }],
      },
      GetAvailableMaskGroups: {
        description:
          "Scans every token currently on the map and returns the distinct {maskGroup, label} pairs found among their maskable UI elements, for a generic map-wide mask-toggle settings UI.",
        args: [],
      },
    };
  }

  // ── Token UI actions ──────────────────────────────────────────────────────

  /**
   * Wires Fabric.js event listeners onto a token UI element for every action
   * declared in `element.tokenData.actions`.
   *
   * Token JSON example:
   *   "actions": {
   *     "onClick":    { "Action": "openCard" },
   *     "onDblClick": { "Action": "openCard" },
   *     "onHover":    { "Action": "highlight" },
   *     "onHoverEnd": { "Action": "clearHighlight" },
   *     "onRightClick": { "Action": "contextMenu" }
   *   }
   *
   * Supported keys are listed in TOKEN_UI_EVENT_MAP at the top of this file.
   */
  _wireTokenUIActions(element, parentToken) {
    const actions = element.tokenData?.actions;
    if (!actions) return;

    let needsPointerCursor = false;

    for (const [eventKey, action] of Object.entries(actions)) {
      const fabricEvent = TOKEN_UI_EVENT_MAP[eventKey];
      if (!fabricEvent) {
        console.warn(
          `TokenManager: unknown action event key "${eventKey}" on element "${element.name}". ` +
          `Supported keys: ${Object.keys(TOKEN_UI_EVENT_MAP).join(", ")}`
        );
        continue;
      }

      if (POINTER_CURSOR_ACTIONS.has(eventKey)) needsPointerCursor = true;

      if (eventKey === "onRightClick") {
        element.on(fabricEvent, (opt) => {
          if (opt.e?.button !== 2) return;
          this._dispatchTokenUIAction(parentToken, element, action);
        });
      } else {
        element.on(fabricEvent, () => {
          this._dispatchTokenUIAction(parentToken, element, action);
        });
      }
    }

    if (needsPointerCursor) element.hoverCursor = "pointer";
  }

  /**
   * Dispatches a single token UI action.
   *
   * Two action types are supported, selected by which key is present:
   *
   * ── Server-side  (key: "Action") ─────────────────────────────────────────
   *   Runs it via ClientMediator.sendCommand("Action", "Run", ...) (ActionService,
   *   wraps `execute_action`).  `cardId` and `tokenId` are always appended to
   *   `args` so the server handler can scope the request.
   *
   *   Example:
   *     { "Action": "set_status_poisoned", "Args": { "value": "true" } }
   *
   * ── Client-side  (key: "ClientMediatorAction") ────────────────────────────
   *   Calls ClientMediator.sendCommand with the given panel/command/data.
   *   Only commands listed in ALLOWED_TOKEN_UI_MEDIATOR_COMMANDS are permitted.
   *   Template variables `{{cardId}}` and `{{tokenId}}` inside string values of
   *   `data` are substituted with the real IDs at dispatch time.
   *
   *   Example:
   *     { "ClientMediatorAction": {
   *         "panel":   "Game",
   *         "command": "CreateNewPanel",
   *         "data":    { "type": "CardPanel", "props": { "id": "{{cardId}}" } }
   *     }}
   *
   * @param {FabricObject}          parentToken  The main token canvas object.
   * @param {FabricObject}          element      The UI element that fired the action.
   * @param {object}                action       The action descriptor from tokenData.
   */
  _dispatchTokenUIAction(parentToken, element, action) {
    // ── Server-side action ──────────────────────────────────────────────────
    if (action.Action) {
      ClientMediator.sendCommand("Action", "Run", {
        name: action.Action,
        args: {
          ...(action.Args ?? {}),
          cardId:  parentToken?.tokenData?.cardId,
          tokenId: parentToken?.id,
        },
      });
      return;
    }

    // ── Client-side ClientMediator action ───────────────────────────────────
    if (action.ClientMediatorAction) {
      const { panel, command, data } = action.ClientMediatorAction;

      if (!panel || !command) {
        console.warn(
          `TokenManager: ClientMediatorAction on "${element?.name}" is missing "panel" or "command"`,
          action
        );
        return;
      }

      const key = `${panel}.${command}`;
      if (!ALLOWED_TOKEN_UI_MEDIATOR_COMMANDS[key]) {
        console.warn(
          `TokenManager: blocked ClientMediatorAction "${key}" on "${element?.name}" — not in allowlist. ` +
          `Allowed: ${Object.keys(ALLOWED_TOKEN_UI_MEDIATOR_COMMANDS).join(", ")}`
        );
        return;
      }

      const context = {
        cardId:  parentToken?.tokenData?.cardId ?? "",
        tokenId: parentToken?.id ?? "",
      };
      ClientMediator.sendCommand(panel, command, this._resolveTemplates(data ?? {}, context));
      return;
    }

    console.warn(
      `TokenManager: action on "${element?.name}" has neither "Action" nor "ClientMediatorAction" key`,
      action
    );
  }

  /**
   * Recursively substitutes `{{key}}` placeholders inside string values of
   * a plain object/array/string tree.  Non-string leaves are returned as-is.
   */
  _resolveTemplates(obj, context) {
    if (typeof obj === "string") {
      return obj.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] ?? "");
    }
    if (Array.isArray(obj)) {
      return obj.map((v) => this._resolveTemplates(v, context));
    }
    if (obj && typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, this._resolveTemplates(v, context)])
      );
    }
    return obj;
  }

  /**
   * Public entry point for canvas-level behaviors (e.g. OnTokenUIActionClickBehavior)
   * to dispatch a token UI action without duplicating the allowlist logic.
   *
   * Called via ClientMediator with contextId so it routes to the correct
   * TokenManager instance when multiple battlemaps are open.
   */
  DispatchTokenUIAction({ parentToken, element, action }) {
    this._dispatchTokenUIAction(parentToken, element, action);
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
    // Bug fix: a token's own UI sub-elements (label, icons, ...) also carry a
    // small tokenData object of their own (anchor/propDeps, no cardId — see
    // CanvasObjectLoadToken/token_character.json) and were being matched here
    // too, alongside their actual parent token. UpdateTokensPropertySpecific's
    // per-token loop already re-checks each token's OWN additionalObjects for
    // matching deps — including sub-elements here as well meant they got
    // checked a SECOND time, but as "objects" with no id/cardId of their own,
    // so _resolveParentId("card", subElement) came back undefined and the
    // parentId guard failed open — any card's property change matched every
    // OTHER token's label sub-element indiscriminately. Only the real
    // top-level token has isToken === true; sub-elements are isTokenUI.
    return this._getCanvas()
      .getObjects()
      .filter((o) => o.tokenData != null && o.isToken === true);
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

  // ── Generic element masking (on/off + GM-only, map-wide with per-token override) ──

  /**
   * A token UI element opts into the generic masking system by declaring
   * `tokenData.maskGroup` (a plain string key, e.g. "hp" — grouping e.g.
   * hp_bar_bg + hp_bar_fill under one togglable unit) and, optionally,
   * `tokenData.label` for display. Core never hardcodes what a mask group
   * IS — it only derives two property names from whatever key the addon's
   * own JSON declares, at two scopes:
   *   - map-scoped  (MapModel, parentId = current map)   — the shared default
   *   - element-scoped (ElementModel, parentId = token.id) — optional per-token override
   * Element-scoped wins when explicitly set; otherwise the map-scoped value
   * applies; otherwise the group defaults to enabled / not-GM-only.
   */
  _maskPropertyNames(group) {
    return [`mask_${group}_enabled`, `mask_${group}_gmonly`];
  }

  /**
   * Resolves the effective {enabled, gmOnly}-derived visibility for every
   * distinct maskGroup declared among a token's additionalObjects, as a
   * Map<maskGroup, boolean> of final visibility (gmOnly already folded in
   * against the viewer's own GM status).
   */
  async _resolveMaskStates(token) {
    const groups = [...new Set(
      (token.additionalObjects ?? [])
        .map((e) => e.tokenData?.maskGroup)
        .filter(Boolean)
    )];
    if (!groups.length) return new Map();

    const names = [...new Set(groups.flatMap((g) => this._maskPropertyNames(g)))];
    const mapId = this._getSelectedMap()?.id;

    const [mapProps, elementProps] = await Promise.all([
      mapId
        ? ClientMediator.sendCommandAsync("Properties", "GetByNames", { parentId: mapId, names }).catch(() => [])
        : Promise.resolve([]),
      ClientMediator.sendCommandAsync("Properties", "GetByNames", { parentId: token.id, names }).catch(() => []),
    ]);

    const isGM = ClientMediator.sendCommand("Game", "GetIsGM");

    const result = new Map();
    for (const group of groups) {
      const [enabledKey, gmOnlyKey] = this._maskPropertyNames(group);
      const elEnabled = elementProps.find((p) => p.name === enabledKey)?.value;
      const mapEnabled = mapProps.find((p) => p.name === enabledKey)?.value;
      const elGmOnly = elementProps.find((p) => p.name === gmOnlyKey)?.value;
      const mapGmOnly = mapProps.find((p) => p.name === gmOnlyKey)?.value;

      const enabled = elEnabled !== undefined
        ? UtilityHelper.ParseBool(elEnabled)
        : mapEnabled !== undefined ? UtilityHelper.ParseBool(mapEnabled) : true;
      const gmOnly = elGmOnly !== undefined
        ? UtilityHelper.ParseBool(elGmOnly)
        : mapGmOnly !== undefined ? UtilityHelper.ParseBool(mapGmOnly) : false;

      result.set(group, enabled && (!gmOnly || isGM));
    }
    return result;
  }

  /**
   * Scans every token currently on the map for distinct {maskGroup, label}
   * pairs — used by a generic, data-driven map-wide mask-toggle settings UI
   * that has no hardcoded knowledge of what any addon's tokens declare.
   */
  GetAvailableMaskGroups() {
    const found = new Map();
    for (const token of this._allTokens()) {
      for (const element of token.additionalObjects ?? []) {
        const group = element.tokenData?.maskGroup;
        if (!group || found.has(group)) continue;
        found.set(group, element.tokenData?.label ?? group);
      }
    }
    return Array.from(found, ([maskGroup, label]) => ({ maskGroup, label }));
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

    // A part masked off (mask_<group>_enabled, see _resolveMaskStates) stays hidden
    // whatever its own visibility rule says, also on a live single-value update.
    if (objectProperty === "visible" && targetElement?._maskVisible === false) {
      value = false;
    }

    // Fabric crashes with a 0×0 cache canvas — clamp width/height to at least 1px.
    if ((objectProperty === "width" || objectProperty === "height") && typeof value === "number") {
      value = Math.max(value, 1);
    }

    // Special case: image src must be a full resource URL so FabricTypesInitializer
    // can intercept it and fetch via WebRTC.  A raw UUID (no slashes) needs to be
    // converted, and fabric.Image needs setSrc() — not just set() — to actually
    // reload the displayed image.
    //
    // Bug fix: a card's "tokenImage" property can exist as an empty string rather
    // than being entirely absent (e.g. the CardSettingsPanel field was touched and
    // saved blank) — `raw === undefined` above doesn't catch that, so this used to
    // reach here with value === "", _toResourceUrl("") returning "" unchanged, and
    // setSrc("") wiping out the element entirely. That blanked a token's image
    // moments after _createTokenAsync/ConvertFromDTO had correctly rendered the
    // emptyTokenImage placeholder, since this dep re-applies right after a token
    // is added to canvas (OnAddElementBehavior → CanvasObjectLoadToken →
    // UpdateTokenBasedOnProperties). Falling back here too keeps this path
    // consistent with those two.
    if (objectProperty === "src") {
      const url = _toResourceUrl(value || SYSTEM_ASSET_KEYS.EMPTY_TOKEN_IMAGE);
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
    // Mask settings (mask_{group}_enabled / mask_{group}_gmonly) are never propDeps
    // declared in addon JSON — they're derived generically from whatever maskGroup
    // keys this token's own additionalObjects declare — so they can't be matched by
    // the propDeps-based `work` collection below. Recognize them here instead and
    // trigger a full mask-aware visibility recompute for this one token.
    const maskMatch = /^mask_(.+)_(enabled|gmonly)$/.exec(property.name ?? "");
    if (maskMatch) {
      const group = maskMatch[1];
      const declaresGroup = (object.additionalObjects ?? []).some(
        (e) => e.tokenData?.maskGroup === group
      );
      const isMapScoped = property.entityName?.toLowerCase().startsWith("map")
        && property.parentId === this._getSelectedMap()?.id;
      const isElementScoped = property.entityName?.toLowerCase().startsWith("element")
        && property.parentId === object.id;

      if (declaresGroup && (isMapScoped || isElementScoped)) {
        this.UpdateTokenBasedOnProperties({ tokenId: object.id }).catch((err) =>
          console.error("TokenManager: mask visibility refresh failed", err)
        );
      }
      return;
    }

    let mutated = false;

    // Collect every (target element, dep) pair that matches the changed property
    const work = []; // [{ target, dep }]

    const matchesDep = (d) => {
      if (property.entityName && !property.entityName.toLowerCase().startsWith(d.source)) return false;
      // Bug fix: this used to only check the property's TYPE (entityName) and
      // NAME (dtoProperty) — never that it actually belongs to THIS token's
      // own card/element. Any property named e.g. "character_name" changing
      // on ANY card matched every token's "character_name" propDep, so
      // renaming one card's token relabeled every OTHER card's tokens too.
      // _resolveParentId("map"/"game", object) is intentionally global (every
      // token IS on the same map/game), so only "card"/"element" sources are
      // actually narrowed by this check.
      if (property.parentId) {
        const expectedParentId = this._resolveParentId(d.source, object);
        if (expectedParentId && property.parentId !== expectedParentId) return false;
      }
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

    // Reposition after a live property change, not just re-render — a "right-top"
    // status icon toggled mid-session needs its stacked siblings re-packed too
    // (see UpdateTokenUIPositions), not just its own visibility flipped.
    if (mutated) {
      this.UpdateTokenUIPositions({ object });
    }
  }

  // ── Public commands ─────────────────────────────────────────────────────

  /**
   * Revive all token UI element specs into live Fabric objects.
   *
   * Three spec types are supported:
   *
   * • Standard Fabric types (rect, text, path, image, group, …):
   *   Handled by `fabric.util.enlivenObjects`.
   *
   * • `"type": "svg"` — inline SVG string or resource URL:
   *   Fields: `svgString` (inline markup) or `src` (resource ID / URL).
   *   Uses `fabric.loadSVGFromString` → `fabric.util.groupSVGElements`.
   *
   * • `"type": "reactIcon"` — a react-icons icon, loaded by pack name:
   *   Fields: `iconPack` (e.g. `"gi"`, `"fa"`, `"md"`) and `iconName`
   *   (the named export, e.g. `"GiPoisonBottle"`).  The pack is imported
   *   dynamically so only the requested pack is included in the chunk.
   *   The icon component is rendered to an SVG string via
   *   `renderToStaticMarkup`, then fed into the same SVG pipeline as above.
   *
   * Token JSON examples:
   *   { "name": "status_poisoned", "type": "svg", "width": 20, "height": 20,
   *     "svgString": "<svg ...>...</svg>", "tokenData": { "anchor": "right-top" } }
   *
   *   { "name": "status_poisoned", "type": "reactIcon",
   *     "iconPack": "gi", "iconName": "GiPoisonBottle",
   *     "width": 20, "height": 20, "fill": "rgba(50,200,50,0.9)",
   *     "tokenData": { "anchor": "right-top", ... } }
   */
  async _enlivenTokenUiElements(specs) {
    const indices = { svg: [], reactIcon: [], fabric: [] };
    specs.forEach((s, i) => {
      if (s.type === "svg") indices.svg.push(i);
      else if (s.type === "reactIcon") indices.reactIcon.push(i);
      else indices.fabric.push(i);
    });

    const svgResults = await Promise.all(
      indices.svg.map((i) => this._loadSVGElement(specs[i]))
    );

    const reactIconResults = await Promise.all(
      indices.reactIcon.map((i) => this._loadReactIconElement(specs[i]))
    );

    const fabricSpecs = indices.fabric.map((i) => specs[i]);
    const fabricResults = await new Promise((resolve) => {
      if (!fabricSpecs.length) { resolve([]); return; }
      fabric.util.enlivenObjects(fabricSpecs, resolve);
    });

    // Reconstruct in original order
    const out = new Array(specs.length);
    let si = 0, ri = 0, fi = 0;
    specs.forEach((_, i) => {
      if (specs[i].type === "svg") out[i] = svgResults[si++];
      else if (specs[i].type === "reactIcon") out[i] = reactIconResults[ri++];
      else out[i] = fabricResults[fi++];
    });

    return out.filter(Boolean);
  }

  /**
   * Load a `"type": "reactIcon"` spec into a Fabric Group via the SVG pipeline.
   *
   * The icon pack is imported dynamically (code-split per pack) so only packs
   * referenced by tokens in the current session are ever fetched.
   * `renderToStaticMarkup` converts the React icon component to an SVG string,
   * which is then handed off to `_loadSVGElement`.
   *
   * Spec fields:
   *   iconPack   {string} react-icons sub-package, e.g. "gi", "fa", "md"
   *   iconName   {string} named export from the pack, e.g. "GiPoisonBottle"
   *   width      {number} rendered size (px) — also passed as `size` to the icon
   *   height     {number} rendered size (px)
   *   fill       {string} icon colour, e.g. "rgba(50,200,50,0.9)"
   *   …any other spec fields (left, top, originX/Y, tokenData, …) pass through
   */
  async _loadReactIconElement(spec) {
    const { iconPack, iconName } = spec;
    if (!iconPack || !iconName) {
      console.warn(
        `TokenManager: reactIcon "${spec.name}" requires both "iconPack" and "iconName"`
      );
      return null;
    }

    const loader = ICON_PACK_LOADERS[iconPack];
    if (!loader) {
      console.warn(
        `TokenManager: unknown react-icons pack "${iconPack}" for element "${spec.name}". ` +
        `Supported packs: ${Object.keys(ICON_PACK_LOADERS).join(', ')}`
      );
      return null;
    }

    let pack;
    try {
      pack = await loader();
    } catch {
      console.warn(
        `TokenManager: could not load react-icons pack "${iconPack}" for element "${spec.name}"`
      );
      return null;
    }

    const IconComponent = pack[iconName];
    if (!IconComponent) {
      console.warn(
        `TokenManager: icon "${iconName}" not found in react-icons/${iconPack}`
      );
      return null;
    }

    // renderToStaticMarkup is synchronous and works in browser builds — it does not
    // require any Node.js APIs. The previous approach (flushSync + createRoot) inside
    // an async function was unreliable: React 18 concurrent mode does not guarantee
    // the initial render of a new root completes synchronously in an async context,
    // so container.innerHTML was empty and the element was silently dropped.
    const size = spec.width ?? spec.height ?? 24;
    const fill = spec.fill ?? "#ffffff";
    let svgMarkup = renderToStaticMarkup(
      createElement(IconComponent, { size, color: fill })
    );

    if (!svgMarkup) {
      console.warn(`TokenManager: reactIcon "${spec.name}" rendered empty markup`);
      return null;
    }

    // react-icons uses fill="currentColor" on paths — Fabric's SVG parser cannot
    // resolve CSS-inherited `currentColor`, so replace it with the explicit color.
    svgMarkup = svgMarkup.replace(/currentColor/g, fill);

    // Delegate to the shared SVG loader — all positional/tokenData props carry through
    return this._loadSVGElement({ ...spec, svgString: svgMarkup });
  }

  /**
   * Load a single `"type": "svg"` spec into a Fabric Group.
   * Applies positional / visual properties from the spec onto the group.
   */
  async _loadSVGElement(spec) {
    let svgMarkup = spec.svgString;

    if (!svgMarkup && spec.src) {
      const data = await _getMaterial(spec.src, "text/plain").catch(() => null);
      svgMarkup = typeof data === "string" ? data : null;
    }

    if (!svgMarkup) {
      console.warn(`TokenManager: SVG element "${spec.name}" has no svgString or src`);
      return null;
    }

    return new Promise((resolve) => {
      fabric.loadSVGFromString(svgMarkup, (objects, options) => {
        if (!objects?.length) {
          console.warn(`TokenManager: SVG element "${spec.name}" parsed no objects`);
          resolve(null);
          return;
        }

        const group = fabric.util.groupSVGElements(objects, options);

        // Apply spec properties onto the group
        group.set({
          name:     spec.name,
          left:     spec.left     ?? 0,
          top:      spec.top      ?? 0,
          originX:  spec.originX  ?? "left",
          originY:  spec.originY  ?? "top",
          scaleX:   spec.scaleX   ?? 1,
          scaleY:   spec.scaleY   ?? 1,
          angle:    spec.angle    ?? 0,
          opacity:  spec.opacity  ?? 1,
          visible:  spec.visible  ?? true,
          tokenData: spec.tokenData,
        });

        // Scale to declared dimensions (preserves aspect ratio via scaleToWidth)
        if (spec.width && spec.height) {
          group.scaleToWidth(spec.width);
          group.scaleToHeight(spec.height);
        } else if (spec.width) {
          group.scaleToWidth(spec.width);
        } else if (spec.height) {
          group.scaleToHeight(spec.height);
        }

        resolve(group);
      });
    });
  }

  /**
   * Enliven and attach token UI elements for an already-loaded canvas object.
   */
  async CanvasObjectLoadToken({ id }) {
    const canvas = this._getCanvas();
    const object = this._findObject(id);

    if (!object) {
      console.warn(
        `TokenManager.CanvasObjectLoadToken: object "${id}" not found`
      );
      return;
    }

    if (!object.tokenUiElements?.length) return;

    const enlivened = await this._enlivenTokenUiElements(object.tokenUiElements);

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

      // Wire all declared token UI actions (onClick, onHover, onDblClick, …)
      if (element.tokenData?.actions) {
        this._wireTokenUIActions(element, object);
      }

      object.additionalObjects.push(element);
      canvas.add(element);
    });

    this.UpdateTokenUIPositions({ object });
    // UpdateTokenBasedOnProperties restores visibility after applying deps
    this.UpdateTokenBasedOnProperties({ tokenId: id });
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
      const maskStates = await this._resolveMaskStates(object);

      for (const element of object.additionalObjects) {
        // Elements that control their own visibility via a propDep start hidden
        // so the dep (not the reset below) is the source of truth.
        const hasPropVisibility = element.tokenData?.propDeps?.some(
          (d) => d.objectProperty === "visible"
        );

        // Generic on/off + GM-only masking (see _resolveMaskStates) — undeclared
        // (no maskGroup) always resolves to visible, so this is a no-op for any
        // element that hasn't opted in.
        const maskGroup = element.tokenData?.maskGroup;
        const maskVisible = maskGroup ? (maskStates.get(maskGroup) ?? true) : true;
        // Exposed on the element itself so OnTokenSelectedBehavior (which sets
        // showOnTokenControl elements visible synchronously on selection, with no
        // access to this async resolution) can respect a masked-off state too.
        element._maskVisible = maskVisible;

        // Restore visibility: hidden if disabled, control-only, prop-driven, or masked off
        element.visible =
          element.enabled !== false &&
          !element.tokenData?.showOnTokenControl &&
          !hasPropVisibility &&
          maskVisible;

        // Skip dep evaluation entirely for permanently-hidden elements;
        // prop-driven elements must still run so their visibility dep fires.
        if (!element.visible && !hasPropVisibility) continue;

        if (
          await this._fetchAndApplyDeps(
            object,
            element,
            element.tokenData?.propDeps
          )
        ) {
          mutated = true;
        }

        // A visible-propDep element's own dep is authoritative over the initial
        // reset above (that's the whole point of hasPropVisibility) — but masking
        // off must still win over it, so re-apply the AND once more afterward.
        if (hasPropVisibility && !maskVisible) {
          element.visible = false;
        }
      }
    }

    // Reposition after visibility/deps settle, not just once at load — without
    // this, toggling a "right-top" status icon on/off (or any other propDep-
    // driven visibility change) would correctly show/hide it but the auto-stack
    // above would never re-pack the row, leaving stale positions. This also
    // performs the render call UpdateTokenUIPositions itself does.
    if (mutated) {
      this.UpdateTokenUIPositions({ object });
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
  }

  /**
   * Internal: resolve the token definition and its inputs (from the card, or
   * from the definition alone), build the Fabric object, and send element_add.
   */
  async _createTokenAsync({ cardId, tokenRef, image }, position) {
    const map = this._getSelectedMap();
    if (!map) {
      console.error("TokenManager._createTokenAsync: no map selected");
      return;
    }

    const { gridSize } = map;

    const inputs = cardId
      ? await this._tokenInputsFromCard(cardId)
      : { tokenId: tokenRef, displayName: null, tokenSize: null, tokenImageId: image, imageSource: "element" };
    if (!inputs) return;
    const { tokenId, tokenImageId, imageSource } = inputs;

    // Fetch the token JSON template
    const tokenRaw = await _getMaterial(tokenId, "application/json");
    if (!tokenRaw) {
      console.error(
        `TokenManager._createTokenAsync: failed to fetch token template "${tokenId}"`
      );
      return;
    }

    const token = JSON.parse(tokenRaw);
    const tokenName = cardId
      ? `${token.prefix ?? "token"} ${inputs.displayName}`
      : token.prefix ?? "Token";
    const tokenSize = inputs.tokenSize ?? (parseInt(token.size, 10) || 1);

    // Convert the raw resource ID to a full URL so fabric.util.loadImage
    // recognises it as a backend resource and fetches it via WebRTC. No
    // tokenImage assigned yet (card has none set) falls back to the
    // emptyTokenImage placeholder key rather than loading no image at all.
    const tokenImageUrl = _toResourceUrl(tokenImageId || SYSTEM_ASSET_KEYS.EMPTY_TOKEN_IMAGE);

    // Build the Fabric image object
    fabric.Image.fromURL(tokenImageUrl, (fabricObject) => {
      fabricObject.set({
        ...token.object,
        name: tokenName,
        left: position.x,
        top: position.y,
        cardId: cardId,
        tokenData: {
          ...token?.tokenData,
          cardId,
          // Token-root declarative config (sibling to per-addition propDeps) for
          // the on-select quick-edit overlay (TokenQuickEditOverlay) — an array
          // of {name, dtoProperty, label, source} the addon's own token JSON
          // declares; core only enumerates them, no hardcoded field knowledge.
          editableProps: token.editableProps ?? [],
          // Same spirit, for TokenIconPickerOverlay — an array of
          // {id, label, iconPack, iconName, dtoProperty, source} manifest
          // entries. Each needs a matching `additions[]` icon (own visible
          // propDep on the same dtoProperty) to actually render on the token;
          // this manifest just tells the picker what exists and how to preview
          // and toggle it.
          assignableIcons: token.assignableIcons ?? [],
          propDeps: [
            ...(token?.tokenData?.propDeps ?? []),
            { ...IMAGE_PROP_DEP, source: imageSource },
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

      // If the token JSON declares a clipPath spec, instantiate it as a real
      // Fabric object. fabricObject.set() above only copies the plain spec —
      // Fabric does not auto-enliven nested clipPath objects through set().
      //
      // For circles with no explicit radius (or radius ≤ 0) we compute it from
      // the image's natural size: min(w,h)/2 in LOCAL (pre-scale) coordinates,
      // which maps to exactly the visual token circle after scaleToWidth().
      const clipSpec = token.object?.clipPath;
      if (clipSpec?.type === "circle") {
        const radius =
          clipSpec.radius > 0
            ? clipSpec.radius
            : Math.min(fabricObject.width, fabricObject.height) / 2;
        fabricObject.clipPath = new fabric.Circle({
          ...clipSpec,
          radius,
        });
      }

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

  /** A card token's inputs, read from the card's properties. */
  async _tokenInputsFromCard(cardId) {
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
      return null;
    }

    return {
      tokenId,
      displayName: findPropValue(properties, "character_name", "Token"),
      tokenSize: parseInt(findPropValue(properties, "drop_token_size", "1"), 10) || 1,
      tokenImageId: findPropValue(properties, "tokenImage"),
      imageSource: "card",
    };
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

    // Auto-stacking for "right-top" only (status icons — see TokenIconPickerOverlay):
    // multiple simultaneously-visible icons pack together left-to-right from the
    // token's corner instead of each sitting at its own static authored offsetX,
    // which would leave a gap where a currently-hidden icon's fixed slot used to
    // be. Scoped to this one anchor value — nothing else uses "right-top" today,
    // and every other anchor keeps its existing static-offset behavior unchanged.
    // getScaledWidth() is reliable here: _loadSVGElement scales SVG/reactIcon
    // groups to their declared width synchronously before pushing them into
    // additionalObjects, so it's already correct by the time this runs.
    const RIGHT_TOP_GAP = 2;
    const rightTopStackOffset = new Map();
    {
      let running = 0;
      for (const element of token.additionalObjects) {
        if (element?.tokenData?.anchor !== "right-top") continue;
        if (element.visible === false) continue;
        rightTopStackOffset.set(element, running);
        running += (element.getScaledWidth?.() ?? element.width ?? 0) + RIGHT_TOP_GAP;
      }
    }

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
          element.left = zero.x + expectedSize + (rightTopStackOffset.get(element) ?? oX);
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