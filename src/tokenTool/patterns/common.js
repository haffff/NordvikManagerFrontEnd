// Shared by the token part patterns: where a part sits (anchor + offset), its name (the
// stem of its additions' names) and its visibility switch (tokenData.maskGroup + label):
// one show / GM only / hide setting in a game for every addition with that key. A part
// on no switch is always shown.

export const placement = (tokenData = {}) => ({
  anchor: tokenData.anchor ?? "left-top",
  offsetX: tokenData.offsetX ?? 0,
  offsetY: tokenData.offsetY ?? 0,
});

export const groupOf = (tokenData = {}) => ({ group: tokenData.maskGroup, label: tokenData.label ?? tokenData.maskGroup });

/** The switch fields of a part's tokenData: none at all when it's always shown. */
export const switchData = (p) => (p.group ? { maskGroup: p.group, label: p.label ?? p.group } : {});

/** A part's tokenData for these settings, plus anything the pattern adds. */
export const tokenData = (p, extra = {}) => ({
  anchor: p.anchor, offsetX: p.offsetX, offsetY: p.offsetY, ...switchData(p), ...extra,
});

/**
 * A part's name from its additions: the common stem of their names, cut at "_"
 * (hp_bar_bg + hp_bar_fill: hp_bar), or its one addition's name.
 */
export function nameOfAdditions(additions = []) {
  const names = additions.map((a) => a.name ?? "");
  if (names.length <= 1) return names[0] || undefined;
  const split = names.map((n) => n.split("_"));
  const stem = [];
  for (let i = 0; split.every((s) => i < s.length - 1 && s[i] === split[0][i]); i++) stem.push(split[0][i]);
  return stem.join("_") || names[0] || undefined;
}

/** The only dep of a part, when it has exactly one. */
export const onlyDep = (part) => (part.tokenData?.propDeps?.length === 1 ? part.tokenData.propDeps[0] : null);

/**
 * A part's scale and rotation (Fabric's scaleX/scaleY and angle), written only when they
 * aren't the default. A pattern without a scale (icons: their size is it) leaves it out.
 */
export const transform = (p) => ({
  ...(p.scale !== undefined && p.scale !== 1 ? { scaleX: p.scale, scaleY: p.scale } : {}),
  ...(p.rotation ? { angle: p.rotation } : {}),
});

/** A part's scale and rotation as settings. */
export const readTransform = (part, { scale = true } = {}) => ({
  ...(scale ? { scale: part.scaleX ?? 1 } : {}),
  rotation: part.angle ?? 0,
});
