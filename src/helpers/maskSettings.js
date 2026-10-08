import UtilityHelper from "./UtilityHelper";

// Token elements an addon groups for masking (tokenData.maskGroup, e.g. an HP bar)
// can be shown/hidden and made GM-only per map (MapModel properties) and per token
// (ElementModel properties, overriding the map). Each setting is three-way: "Not set"
// passes the decision on (token → map → default), so it's clear what's in effect.

export const MASK_NOT_SET = "notset";

const options = (on, off) => [
  { value: MASK_NOT_SET, label: "Not set" },
  { value: "true", label: on },
  { value: "false", label: off },
];

/** Settings fields (select, stored as properties) for each {maskGroup, label}. */
export const maskSettingFields = (groups, { category, notSetMeans = "this map's setting" } = {}) =>
  groups.flatMap((g) => [
    {
      key: `mask_${g.maskGroup}_enabled`,
      property: true,
      label: `${g.label} — Visible`,
      toolTip: `Show or hide "${g.label}". Not set uses ${notSetMeans} (shown when nothing is set).`,
      type: "select",
      options: options("Shown", "Hidden"),
      parse: (raw) => maskSettingValue(raw),
      category,
    },
    {
      key: `mask_${g.maskGroup}_gmonly`,
      property: true,
      label: `${g.label} — GM Only`,
      toolTip: `Whether only the GM sees "${g.label}". Not set uses ${notSetMeans} (everyone when nothing is set).`,
      type: "select",
      options: options("GM only", "Everyone"),
      parse: (raw) => maskSettingValue(raw),
      category,
    },
  ]);

const parse = (raw) => {
  if (raw === true || raw === false) return raw;
  const parsed = typeof raw === "string" ? UtilityHelper.ParseBool(raw) : null;
  return parsed ?? undefined;
};

/** The option a stored property value shows as. */
export const maskSettingValue = (raw) => {
  const value = parse(raw);
  return value === undefined ? MASK_NOT_SET : String(value);
};

/** The effective setting: the token's when set, else the map's, else the default. */
export const resolveMaskSetting = (elementRaw, mapRaw, fallback) =>
  parse(elementRaw) ?? parse(mapRaw) ?? fallback;
