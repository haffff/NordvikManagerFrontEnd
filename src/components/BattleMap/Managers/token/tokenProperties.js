import ClientMediator from "../../../../ClientMediator";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import TokenUIRules from "../../../../helpers/TokenUIRules";
import { extractPropNames, isExpressionDep, evaluate } from "../../../../helpers/TokenExpressionEvaluator";
import { SYSTEM_ASSET_KEYS } from "../../../../helpers/systemAssets";
import { _isGuid } from "./shared";

// Showing property values on a token's parts.
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

export const tokenProperties = {
  meta: {
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
  },

  methods: {
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
    },

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

      // While the token is dragged (or animated to a remote move) its parts are hidden
      // and their own visibility kept in visibleBeforeDrag, restored afterwards — a
      // change arriving meanwhile goes there, or that restore would undo it.
      if (objectProperty === "visible" && targetElement?.visibleBeforeDrag !== undefined) {
        targetElement.visibleBeforeDrag = value;
        return true;
      }

      // Fabric crashes with a 0×0 cache canvas — clamp width/height to at least 1px.
      // Infinity (a rule dividing by zero) gives one too.
      if ((objectProperty === "width" || objectProperty === "height") && typeof value === "number") {
        value = Number.isFinite(value) ? Math.max(value, 1) : 1;
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
          // setSrc resets width/height to the new picture's own, so a token placed with
          // the placeholder would change size on the map — keep the width it had, as
          // placing does (scaleToWidth), and fit an automatic circle crop to the picture.
          // Scaled directly, not with scaleToWidth: that measures on screen, so map zoom
          // and the token's rotation would change the size on every refresh.
          const shownWidth = targetElement.width * (targetElement.scaleX ?? 1);
          const oldMin = Math.min(targetElement.width, targetElement.height);
          targetElement.setSrc(url, (img) => {
            if (!img?.width || !shownWidth) return;
            img.scale(shownWidth / img.width);
            const clip = img.clipPath;
            if (clip?.type === "circle" && clip.radius === oldMin / 2) {
              clip.set("radius", Math.min(img.width, img.height) / 2);
            }
            img.setCoords?.();
            if (object?.additionalObjects?.length) this.UpdateTokenUIPositions({ object });
            this._getCanvas()?.requestRenderAll();
          });
        }
        return true;
      }

      targetElement.set(objectProperty, value);
      return true;
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
      // A part shown or hidden (e.g. "Show bars" toggled) needs the map drawn again even
      // when no value changed — on the GM's side their own clicks happen to redraw it,
      // on a player's nothing did.
      let visibilityChanged = false;

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
          const wasVisible = element.visible;
          // On-selection parts stay shown while their token is selected on its own
          // (OnTokenSelectedBehavior sets _controlsShown).
          element.visible =
            element.enabled !== false &&
            (!element.tokenData?.showOnTokenControl || !!object._controlsShown) &&
            !hasPropVisibility &&
            maskVisible;

          if (element.visible !== wasVisible) visibilityChanged = true;

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
            if (element.visible) visibilityChanged = true;
            element.visible = false;
          }
        }
      }

      // Reposition after visibility/deps settle, not just once at load — without
      // this, toggling a "right-top" status icon on/off (or any other propDep-
      // driven visibility change) would correctly show/hide it but the auto-stack
      // above would never re-pack the row, leaving stale positions. This also
      // performs the render call UpdateTokenUIPositions itself does.
      if (mutated || visibilityChanged) {
        this.UpdateTokenUIPositions({ object });
        this._getCanvas()?.requestRenderAll();
      }
    },
  },
};
