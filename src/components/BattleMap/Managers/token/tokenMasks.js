import ClientMediator from "../../../../ClientMediator";
import { resolveMaskSetting } from "../../../../helpers/maskSettings";

// A token's mask groups and which of them are on.
export const tokenMasks = {
  meta: {
    GetAvailableMaskGroups: {
      description:
        "Scans every token currently on the map and returns the distinct {maskGroup, label} pairs found among their maskable UI elements, for a generic map-wide mask-toggle settings UI.",
      args: [],
    },
  },

  methods: {
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
     * Element-scoped wins when explicitly set (not "Not set"); otherwise the map-scoped value
     * applies; otherwise the group defaults to enabled / not-GM-only.
     */
    _maskPropertyNames(group) {
      return [`mask_${group}_enabled`, `mask_${group}_gmonly`];
    },

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

      // "GM only" masks are shown to whoever may edit the game.
      const canEditGame = ClientMediator.sendCommand("Game", "GetCanEditGame");

      const result = new Map();
      for (const group of groups) {
        const [enabledKey, gmOnlyKey] = this._maskPropertyNames(group);
        const elEnabled = elementProps.find((p) => p.name === enabledKey)?.value;
        const mapEnabled = mapProps.find((p) => p.name === enabledKey)?.value;
        const elGmOnly = elementProps.find((p) => p.name === gmOnlyKey)?.value;
        const mapGmOnly = mapProps.find((p) => p.name === gmOnlyKey)?.value;

        const enabled = resolveMaskSetting(elEnabled, mapEnabled, true);
        const gmOnly = resolveMaskSetting(elGmOnly, mapGmOnly, false);

        result.set(group, enabled && (!gmOnly || canEditGame));
      }
      return result;
    },

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
    },
  },
};
