import UtilityHelper from "./UtilityHelper";

// Token elements an addon groups for masking (tokenData.maskGroup, e.g. an HP bar)
// can be shown, made GM-only or hidden per map (MapModel properties) and per token
// (ElementModel properties, overriding the map). One four-way choice per element:
// "Not set" passes the decision on (token → map → default: visible to everyone).
// It's kept as two flags, mask_<group>_enabled and mask_<group>_gmonly, which
// TokenManager resolves and an addon may also set on its own (e.g. a "Show bars"
// switch on a token).

export const MASK_NOT_SET = "notset";

const MASK_OPTIONS = [
  { value: MASK_NOT_SET, label: "Not set" },
  { value: "visible", label: "Visible" },
  { value: "gmonly", label: "GM only" },
  { value: "hidden", label: "Hidden" },
];

// The two flags each choice stores.
const MASK_FLAGS = {
  [MASK_NOT_SET]: { enabled: MASK_NOT_SET, gmOnly: MASK_NOT_SET },
  visible: { enabled: "true", gmOnly: "false" },
  gmonly: { enabled: "true", gmOnly: "true" },
  hidden: { enabled: "false", gmOnly: "false" },
};

const maskPropertyNames = (group) => [`mask_${group}_enabled`, `mask_${group}_gmonly`];

const parse = (raw) => {
  if (raw === true || raw === false) return raw;
  const parsed = typeof raw === "string" ? UtilityHelper.ParseBool(raw) : null;
  return parsed ?? undefined;
};

/** The choice a stored pair of flags shows as (either may be unset). */
const maskChoice = (enabledRaw, gmOnlyRaw) => {
  const enabled = parse(enabledRaw);
  const gmOnly = parse(gmOnlyRaw);
  if (enabled === false) return "hidden";
  if (gmOnly === true) return "gmonly";
  if (enabled === true || gmOnly === false) return "visible";
  return MASK_NOT_SET;
};

/** Settings fields (one four-way choice, stored as two properties) for each {maskGroup, label}. */
export const maskSettingFields = (groups, { category, notSetMeans = "this map's setting" } = {}) =>
  groups.map((g) => {
    const [enabledKey, gmOnlyKey] = maskPropertyNames(g.maskGroup);
    return {
      key: `mask_${g.maskGroup}_mode`,
      property: true,
      propertyNames: [enabledKey, gmOnlyKey],
      label: g.label,
      toolTip: `Who sees "${g.label}": everyone (Visible), only the GM, or nobody (Hidden). Not set uses ${notSetMeans} (visible to everyone when nothing is set).`,
      type: "segmented",
      options: MASK_OPTIONS,
      fromProperties: (get) => maskChoice(get(enabledKey), get(gmOnlyKey)),
      toProperties: (choice) => {
        const flags = MASK_FLAGS[choice] ?? MASK_FLAGS[MASK_NOT_SET];
        return { [enabledKey]: flags.enabled, [gmOnlyKey]: flags.gmOnly };
      },
      category,
    };
  });

/** The effective setting: the token's when set, else the map's, else the default. */
export const resolveMaskSetting = (elementRaw, mapRaw, fallback) =>
  parse(elementRaw) ?? parse(mapRaw) ?? fallback;
