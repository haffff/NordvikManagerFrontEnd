import { placement, groupOf, tokenData, onlyDep, transform, readTransform, nameOfAdditions } from "./common";

// Icons, each shown while a yes/no property is true (conditions, counters, a single
// "flying" flag). They can also be offered in the token's icon picker (assignableIcons),
// which sets those properties. Same parts as the dnd5e conditions and counter icons.

export const iconSet = {
  id: "iconSet",
  title: "Status icons",
  writes: ["visible"],
  create: ({ group, name = group, label = "Icons" }) => ({
    group, name, label, source: "card", size: 18, inPicker: true,
    // Named after the part, so it doesn't clash with an icon the token already has.
    icons: [{ id: "icon", label: "Icon", iconPack: "gi", iconName: "GiPoisonBottle", color: "rgba(140,200,60,0.95)", property: `${name}_icon` }],
    anchor: "right-top", offsetX: 0, offsetY: 0, rotation: 0,
  }),

  build(p) {
    return {
      additions: p.icons.map((icon) => ({
        name: `${p.name}_${icon.id}`, type: "reactIcon", iconPack: icon.iconPack, iconName: icon.iconName,
        left: 0, top: 0, width: p.size, height: p.size, originX: "center", originY: "top", fill: icon.color, visible: false, ...transform({ rotation: p.rotation }),
        // The icons turned on line up from the set's place (TokenManager), wherever it is.
        tokenData: tokenData(p, { stack: true, propDeps: [{ dtoProperty: icon.property, objectProperty: "visible", type: "bool", source: p.source }] }),
      })),
      assignableIcons: p.inPicker
        ? p.icons.map((icon) => ({ id: icon.id, label: icon.label, iconPack: icon.iconPack, iconName: icon.iconName, dtoProperty: icon.property, source: p.source }))
        : [],
    };
  },

  /** The rebuilt icons with the file's parts showing the same property, in the set's order. */
  pair(originals, made) {
    const propertyOf = (a) => onlyDep(a)?.dtoProperty;
    return made.map((m) => [m, originals.find((o) => propertyOf(o) === propertyOf(m)) ?? null]);
  },

  /** context.assignableIcons: the token file's, to tell whether the set is in the picker. */
  match(additions, { assignableIcons = [] } = {}) {
    if (!additions.length) return null;
    const deps = additions.map(onlyDep);
    const source = deps[0]?.source;
    const ok = additions.every((a, i) =>
      a.type === "reactIcon" && deps[i]?.objectProperty === "visible" && deps[i].dtoProperty && !deps[i].expression
      && deps[i].source === source && !a.tokenData?.actions);
    if (!ok) return null;

    const { group, label } = groupOf(additions[0].tokenData);
    // Icons are named <name>_<id>: one icon alone still has its set's name before the id.
    const one = additions.length === 1 ? additions[0].name ?? "" : null;
    const name = one?.includes("_") ? one.slice(0, one.lastIndexOf("_")) : nameOfAdditions(additions);
    const offered = deps.map((d) => assignableIcons.find((i) => i.dtoProperty === d.dtoProperty && i.source === source));
    // Some icons offered and some not: this pattern doesn't make that.
    if (offered.some(Boolean) && !offered.every(Boolean)) return null;

    return {
      group, name, label, source, size: additions[0].width, inPicker: offered.every(Boolean),
      icons: additions.map((a, i) => {
        const id = offered[i]?.id ?? (name && a.name.startsWith(`${name}_`) ? a.name.slice(name.length + 1) : a.name);
        return { id, label: offered[i]?.label ?? id, iconPack: a.iconPack, iconName: a.iconName, color: a.fill, property: deps[i].dtoProperty };
      }),
      ...placement(additions[0].tokenData), ...readTransform(additions[0], { scale: false }),
    };
  },
};
