import { describe, it, expect } from "vitest";
import { splitParts, joinParts, addPart, updatePart, setPartGroup, renameGroup, groupsOf, isGroupKey, movePartToGroup, removeGroup, renamePart, nameOfPart, setPartRules, setAdditionRules } from "./parts";
import { PATTERNS } from "./index";
import character from "../fixtures/token_character.json";

// A token file as a list of parts the editor can add, remove, reorder and edit: its
// additions grouped by maskGroup, each group recognised as a pattern or kept as is.
describe("splitParts / joinParts", () => {
  it("the dnd5e character token: HP bar, name label, open-card button, two icon sets", () => {
    const { parts } = splitParts(character);
    expect(parts.map((p) => [p.pattern, p.params?.group])).toEqual([
      ["bar", "hp"], ["label", "name"], ["button", "opencard"], ["iconSet", "counters"], ["iconSet", "conditions"],
    ]);
    const [hp, name, button, counters, conditions] = parts;
    expect(hp.params).toMatchObject({ value: "hp", max: "maxhp", width: 100, height: 8, anchor: "bottom", offsetY: 4 });
    expect(hp.params.colors.map((c) => c.upTo)).toEqual([25, 50, 100]);
    expect(name.params).toMatchObject({ property: "character_name", fontSize: 11 });
    expect(button.params).toMatchObject({ iconName: "GiNotebook", onlySelected: true });
    expect(counters.params).toMatchObject({ inPicker: false });
    expect(counters.params.icons).toHaveLength(20);
    expect(conditions.params).toMatchObject({ inPicker: true });
    expect(conditions.params.icons[0]).toEqual({ id: "blinded", label: "Blinded", iconPack: "gi", iconName: "GiBlindfold", color: "rgba(90,90,90,0.95)", property: "status_blinded" });
  });

  it("joins back to the same file when nothing was changed", () => {
    const { base, parts } = splitParts(character);
    expect(joinParts(base, parts)).toEqual(character);
  });

  it("removing a part removes its parts and the icons it offered", () => {
    const { base, parts } = splitParts(character);
    const out = joinParts(base, parts.filter((p) => p.params?.group !== "conditions"));
    expect(out.additions.some((a) => a.name.startsWith("status_"))).toBe(false);
    expect(out.assignableIcons).toEqual([]);
  });

  it("parts without a group, or that no pattern knows, are kept as they are", () => {
    const def = { name: "t", object: {}, additions: [{ name: "loose", type: "rect" }, { name: "odd", type: "triangle", tokenData: { maskGroup: "odd" } }] };
    const { base, parts } = splitParts(def);
    expect(parts.map((p) => p.pattern)).toEqual(["custom", "custom"]);
    expect(joinParts(base, parts)).toEqual(def);
  });

  it("an icon the picker offers that no part shows stays in the file", () => {
    const def = { name: "t", object: {}, assignableIcons: [{ id: "x", iconPack: "gi", iconName: "GiX", dtoProperty: "x", source: "card" }], additions: [] };
    const { base, parts } = splitParts(def);
    expect(joinParts(base, parts)).toEqual(def);
  });
});

describe("addPart / updatePart", () => {
  it("a new part gets a group no other part uses", () => {
    let parts = splitParts(character).parts;
    parts = addPart(parts, "bar");
    parts = addPart(parts, "bar");
    const groups = parts.map((p) => p.params?.group);
    expect(new Set(groups).size).toBe(groups.length);
    expect(parts.at(-1).additions.length).toBe(2);
  });

  it("changed settings rebuild the part's parts", () => {
    const [hp] = splitParts(character).parts;
    const changed = updatePart(hp, { ...hp.params, width: 60 });
    expect(changed.additions[0].width).toBe(60);
    expect(changed.params.width).toBe(60);
    expect(changed.id).toBe(hp.id);
  });
});

// Changing a part's settings changes what the pattern models and nothing else: names,
// fields the pattern doesn't know (e.g. an editable i-text, a shadow) and the parts'
// order stay as they were in the file.
describe("updatePart keeps what the pattern doesn't model", () => {
  const partOf = (def, group) => splitParts(def).parts.find((p) => p.params?.group === group);

  it("dnd5e conditions: new size, same names and other fields", () => {
    const conditions = partOf(character, "conditions");
    const changed = updatePart(conditions, { ...conditions.params, size: 24 });
    expect(changed.additions.map((a) => a.name)).toEqual(conditions.additions.map((a) => a.name));
    expect(changed.additions[0]).toMatchObject({ name: "status_blinded", width: 24, height: 24, scaleX: 1, angle: 0, opacity: 1 });
    expect(changed.assignableIcons).toEqual(conditions.assignableIcons);
  });

  it("an icon added to a set gets a new part; a removed one goes", () => {
    const conditions = partOf(character, "conditions");
    const icons = [...conditions.params.icons.slice(1), { id: "flying", label: "Flying", iconPack: "gi", iconName: "GiFeather", color: "white", property: "status_flying" }];
    const changed = updatePart(conditions, { ...conditions.params, icons });
    expect(changed.additions[0].name).toBe("status_charmed");
    expect(changed.additions.at(-1).name).toBe("status_flying");
    expect(changed.additions.some((a) => a.name === "status_blinded")).toBe(false);
    expect(changed.assignableIcons.at(-1)).toMatchObject({ id: "flying", dtoProperty: "status_flying" });
  });

  it("an editable i-text label stays one, with its own extra fields", () => {
    const def = { name: "t", object: {}, additions: [{
      name: "notes", type: "i-text", editable: true, shadow: "1px 1px 2px black", width: 80, fontSize: 10, fontFamily: "Arial", fontWeight: "normal", fill: "white", stroke: null,
      tokenData: { anchor: "top", offsetX: 0, offsetY: -12, maskGroup: "notes", label: "Notes", ignoreRelativePosition: false,
        propDeps: [{ dtoProperty: "note", objectProperty: "text", type: "string", source: "element" }] },
    }] };
    const part = partOf(def, "notes");
    const changed = updatePart(part, { ...part.params, fontSize: 14 });
    expect(changed.additions[0]).toMatchObject({ name: "notes", type: "i-text", editable: true, shadow: "1px 1px 2px black", fontSize: 14 });
    expect(changed.additions[0].tokenData).toMatchObject({ ignoreRelativePosition: false, offsetY: -12, maskGroup: "notes" });
  });

  it("a bar written fill-first keeps its order, and each part its role", () => {
    const [bg, fill] = partOf(character, "hp").additions;
    const def = { name: "t", object: {}, additions: [fill, bg] };
    const part = partOf(def, "hp");
    const changed = updatePart(part, { ...part.params, width: 60 });
    expect(changed.additions.map((a) => a.name)).toEqual(["hp_bar_fill", "hp_bar_bg"]);
    expect(changed.additions[0].tokenData.propDeps[0].expression).toBe("FromTo(%hp%, 0, %maxhp%, 0, 60)");
    expect(changed.additions[1].tokenData.propDeps).toBeUndefined();
    expect(changed.additions[1].width).toBe(60);
  });

  it("a ring's colour rule, of any kind (a value table, HP thresholds, a yes/no), is its own: still a ring, kept as written", () => {
    for (const expression of [
      'Enum(%faction%, {"ally":"green"}, transparent)',
      'FromToEnum(%hp%, 0, %maxhp%, 0, 100, red, [{"min":0,"max":50,"enumValue":"red"},{"min":50,"max":9999,"enumValue":"green"}])',
      'Enum(%infected%, {"true":"green"}, transparent)',
    ]) {
      const dep = { expression, objectProperty: "stroke", type: "string", source: "card" };
      const def = { name: "t", object: {}, additions: [{ name: "ring", type: "circle", radius: 50, stroke: "gold", strokeWidth: 3, tokenData: { anchor: "center", offsetX: 0, offsetY: 0, fitToToken: true, propDeps: [dep] } }] };
      const { base, parts } = splitParts(def);
      expect(parts[0]).toMatchObject({ pattern: "ring", rules: [dep] });
      expect(joinParts(base, parts)).toEqual(def);
      expect(updatePart(parts[0], { ...parts[0].params, width: 5 }).additions[0].tokenData.propDeps).toEqual([dep]);
    }
  });

  it("an unchanged update leaves the dnd5e token as it was", () => {
    const { base, parts } = splitParts(character);
    const same = parts.map((p) => (p.params ? updatePart(p, p.params) : p));
    const out = joinParts(base, same);
    expect(out.additions.map((a) => a.name)).toEqual(character.additions.map((a) => a.name));
    expect(out.additions.find((a) => a.name === "status_blinded")).toMatchObject(
      { scaleX: 1, angle: 0, tokenData: { anchor: "right-top", maskGroup: "conditions" } });
  });
});

describe("scale and rotation", () => {
  it("set back to none, the file's own value doesn't stay", () => {
    const def = { name: "t", object: {}, additions: [{
      name: "n_text", type: "text", text: "", width: 100, height: 12, fontSize: 11, fontFamily: "Arial", fontWeight: "bold",
      fill: "white", stroke: "black", strokeWidth: 0.5, angle: 30, scaleX: 2, scaleY: 2,
      tokenData: { anchor: "bottom", offsetX: 0, offsetY: 16, maskGroup: "n", label: "Name",
        propDeps: [{ dtoProperty: "name", objectProperty: "text", type: "string", source: "card" }] },
    }] };
    const [part] = splitParts(def).parts;
    expect(part.params).toMatchObject({ rotation: 30, scale: 2 });
    const [text] = updatePart(part, { ...part.params, rotation: 0, scale: 1 }).additions;
    expect(text).toMatchObject({ angle: 0, scaleX: 1, scaleY: 1 });
  });

  it("an icon's own scale is left alone: icons are sized by their size setting", () => {
    const def = { name: "t", object: {}, assignableIcons: [], additions: [{
      name: "s_a", type: "reactIcon", iconPack: "gi", iconName: "GiSkull", width: 18, height: 18, fill: "white", visible: false,
      scaleX: 2, scaleY: 2, angle: 15,
      tokenData: { anchor: "right-top", offsetX: 0, offsetY: 0, maskGroup: "s", label: "S",
        propDeps: [{ dtoProperty: "s_a", objectProperty: "visible", type: "bool", source: "card" }] },
    }] };
    const [part] = splitParts(def).parts;
    const [icon] = updatePart(part, { ...part.params, rotation: 0 }).additions;
    expect(icon).toMatchObject({ angle: 0, scaleX: 2, scaleY: 2 });
  });
});

// One mask group (one Visible / GM only / Hidden choice in a game) can hold several
// parts, e.g. an HP bar and the HP as text. The editor tells them apart by pattern.
describe("parts sharing a mask group", () => {
  const inGroup = (part, group, label) => setPartGroup(part, { group, label });
  const hpFile = () => {
    let parts = addPart(addPart([], "bar"), "label");
    parts = [inGroup(parts[0], "hp", "HP"), inGroup(parts[1], "hp", "HP")];
    return joinParts({ name: "t", object: {} }, parts);
  };

  it("a bar and a label in one group are two parts of that group, and join back the same", () => {
    const file = hpFile();
    expect(file.additions.map((a) => a.tokenData.maskGroup)).toEqual(["hp", "hp", "hp"]);
    const { base, parts } = splitParts(file);
    expect(parts.map((p) => [p.pattern, p.params.group, p.params.label])).toEqual([["bar", "hp", "HP"], ["label", "hp", "HP"]]);
    expect(joinParts(base, parts)).toEqual(file);
  });

  it("something no pattern knows in a group stays custom on its own; the rest are still parts", () => {
    const file = hpFile();
    file.additions.splice(2, 0, { name: "odd", type: "triangle", tokenData: { maskGroup: "hp", label: "HP" } });
    expect(splitParts(file).parts.map((p) => p.pattern)).toEqual(["bar", "custom", "label"]);
  });

  it("the file's order is kept when groups take turns (drawing order)", () => {
    let parts = addPart(addPart(addPart([], "bar"), "label"), "label");
    parts = [inGroup(parts[0], "hp", "HP"), parts[1], inGroup(parts[2], "hp", "HP")];
    const file = joinParts({ name: "t", object: {} }, parts);
    const split = splitParts(file);
    expect(split.parts.map((p) => [p.pattern, p.params.group])).toEqual([["bar", "hp"], ["label", "label"], ["label", "hp"]]);
    expect(joinParts(split.base, split.parts)).toEqual(file);
  });

  it("the dnd5e token still reads as before (each group one part)", () => {
    expect(splitParts(character).parts.map((p) => p.pattern)).toEqual(["bar", "label", "button", "iconSet", "iconSet"]);
  });

  it("moving a part writes the group's key and label on every addition; custom parts too", () => {
    const [bar] = addPart([], "bar");
    const moved = setPartGroup(bar, { group: "hp", label: "HP" });
    for (const a of moved.additions) expect(a.tokenData).toMatchObject({ maskGroup: "hp", label: "HP" });
    expect(moved.additions.map((a) => a.name)).toEqual(bar.additions.map((a) => a.name)); // names stay

    const custom = { id: "c", pattern: "custom", additions: [{ name: "odd", type: "triangle" }], assignableIcons: [] };
    expect(setPartGroup(custom, { group: "hp", label: "HP" }).additions[0].tokenData).toEqual({ maskGroup: "hp", label: "HP" });
  });

  it("the groups: key, label (the first part's, as a game shows it) and their parts", () => {
    const { parts } = splitParts(hpFile());
    expect(groupsOf(parts)).toEqual([{ key: "hp", label: "HP", parts: [0, 1] }]);
  });

  it("renaming a group renames it on all its parts", () => {
    const { parts } = splitParts(hpFile());
    const renamed = renameGroup(parts, "hp", { key: "health", label: "Health" });
    expect(renamed.map((p) => [p.params.group, p.params.label])).toEqual([["health", "Health"], ["health", "Health"]]);
  });

  it("group keys: letters, digits and _ (they become mask_<key>_enabled property names)", () => {
    expect(["hp", "hp_2", "HP"].map(isGroupKey)).toEqual([true, true, true]);
    expect(["", "h p", "hp-2", "ü"].map(isGroupKey)).toEqual([false, false, false, false]);
  });

  it("no two additions share a name, even after moving icon sets into one group and adding icons", () => {
    let parts = addPart(addPart([], "iconSet"), "iconSet");
    parts = parts.map((p) => setPartGroup(p, { group: "status", label: "Status" }));
    // Both sets get an icon with the same id.
    parts = parts.map((p) => updatePart(p, { ...p.params, icons: [...p.params.icons, { ...p.params.icons[0], id: "extra", property: `${p.id}_extra` }] }));
    const names = joinParts({ name: "t", object: {} }, parts).additions.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// A visibility switch (tokenData.maskGroup + label) is only a shared show/hide key in a
// game. A part is itself whatever switch it's on, or on none (always shown): its name is
// its own (the stem of its additions' names), not the switch's label.
describe("visibility switches", () => {
  const blank = { name: "t", object: {} };

  it("a part on no switch keeps its pattern, and the file comes back the same", () => {
    let parts = addPart(addPart([], "bar"), "label");
    parts = parts.map((p) => setPartGroup(p, null));
    const file = joinParts(blank, parts);
    for (const a of file.additions) {
      expect(a.tokenData).not.toHaveProperty("maskGroup");
      expect(a.tokenData).not.toHaveProperty("label");
    }
    const split = splitParts(file);
    expect(split.parts.map((p) => [p.pattern, p.params.group])).toEqual([["bar", undefined], ["label", undefined]]);
    expect(joinParts(split.base, split.parts)).toEqual(file);
  });

  it("an always-shown part between two on a switch is a part of its own", () => {
    let parts = addPart(addPart(addPart([], "bar"), "rect"), "label");
    parts = [setPartGroup(parts[0], { group: "hp", label: "HP" }), setPartGroup(parts[1], null), setPartGroup(parts[2], { group: "hp", label: "HP" })];
    const split = splitParts(joinParts(blank, parts));
    expect(split.parts.map((p) => [p.pattern, p.params.group])).toEqual([["bar", "hp"], ["rect", undefined], ["label", "hp"]]);
  });

  it("a part's name: the common stem of its additions' names, or its one addition's name", () => {
    expect(splitParts(character).parts.map(nameOfPart)).toEqual(["hp_bar", "name_label", "open_card_btn", "counter_icon", "status"]);
    const custom = { id: "c", pattern: "custom", additions: [{ name: "odd", type: "triangle" }], assignableIcons: [] };
    expect(nameOfPart(custom)).toBe("odd");
  });

  it("new parts get a free name, their own switch named after it, and additions named from it", () => {
    const parts = addPart(addPart(addPart([], "rect"), "rect"), "bar");
    expect(parts.map((p) => [p.params.name, p.params.group, p.params.label])).toEqual([["rect", "rect", "Rectangle"], ["rect2", "rect2", "Rectangle"], ["bar", "bar", "Bar"]]);
    expect(joinParts(blank, parts).additions.map((a) => a.name)).toEqual(["rect", "rect2", "bar_bg", "bar_fill"]);
  });

  it("renaming a part renames its additions (the stem), not its switch", () => {
    const [hp, name] = splitParts(character).parts;
    const bar = renamePart(hp, "health");
    expect(bar.additions.map((a) => a.name)).toEqual(["health_bg", "health_fill"]);
    expect(bar.params).toMatchObject({ name: "health", group: "hp" });
    expect(renamePart(name, "title").additions.map((a) => a.name)).toEqual(["title"]);
    const custom = { id: "c", pattern: "custom", additions: [{ name: "odd_a" }, { name: "odd_b" }], assignableIcons: [] };
    expect(renamePart(custom, "even").additions.map((a) => a.name)).toEqual(["even_a", "even_b"]);
    // A rebuild after the rename keeps the new names.
    expect(updatePart(bar, { ...bar.params, width: 60 }).additions.map((a) => a.name)).toEqual(["health_bg", "health_fill"]);
  });

  it("a part moves onto another switch, a new one of its own (named after the part), or none", () => {
    const { parts } = splitParts(character);
    const onHp = movePartToGroup(parts, 1, "hp");
    expect(onHp[1].params).toMatchObject({ group: "hp", label: groupsOf(parts)[0].label });
    const own = movePartToGroup(onHp, 1, "");
    expect(own[1].params).toMatchObject({ group: "name_label", label: "name_label" });
    const none = movePartToGroup(parts, 1, null);
    expect(none[1].params.group).toBeUndefined();
    expect(joinParts(blank, none).additions.find((a) => a.name === "name_label").tokenData).not.toHaveProperty("maskGroup");
  });

  it("removing a switch leaves its parts always shown, with their patterns", () => {
    const { parts } = splitParts(character);
    const next = removeGroup(parts, "hp");
    expect(groupsOf(next).map((g) => g.key)).toEqual(["name", "opencard", "counters", "conditions"]);
    expect(splitParts(joinParts(blank, next)).parts.map((p) => p.pattern)).toEqual(parts.map((p) => p.pattern));
  });

  it("an icon set on no switch reads its icon ids from its name", () => {
    const file = { ...blank, additions: character.additions.filter((a) => a.tokenData?.maskGroup === "counters").map((a) => {
      const { maskGroup, label, ...tokenData } = a.tokenData;
      return { ...a, tokenData };
    }) };
    const [part] = splitParts(file).parts;
    expect(part.pattern).toBe("iconSet");
    expect(part.params.icons[0].id).toBe("rage");
  });
});

// A part's own rules (propDeps): the ones its pattern doesn't set. They're kept apart from
// the pattern's (which its settings rebuild), the same on every addition of the part.
describe("a part's own rules", () => {
  const blank = { name: "t", object: {} };
  const opacity = { objectProperty: "opacity", type: "number", source: "card", expression: "FromTo(%hp%, 0, %maxhp%, 0.3, 1)" };
  const withRule = (part, dep) => ({ ...part, additions: part.additions.map((a) => ({ ...a, tokenData: { ...a.tokenData, propDeps: [...(a.tokenData.propDeps ?? []), dep] } })) });

  it("a label with an extra opacity rule is still a label; the rule is its own, and the file comes back the same", () => {
    const [label] = addPart([], "label");
    const file = joinParts(blank, [withRule(label, opacity)]);
    const split = splitParts(file);
    expect(split.parts[0].pattern).toBe("label");
    expect(split.parts[0].rules).toEqual([opacity]);
    expect(joinParts(split.base, split.parts)).toEqual(file);
  });

  it("a rebuild (a changed setting) keeps the part's own rules after the pattern's", () => {
    const [label] = addPart([], "label");
    const [part] = splitParts(joinParts(blank, [withRule(label, opacity)])).parts;
    const changed = updatePart(part, { ...part.params, fontSize: 20 });
    expect(changed.additions[0].tokenData.propDeps.map((d) => d.objectProperty)).toEqual(["text", "opacity"]);
  });

  it("own rules on only some additions of a bar: not a bar, nothing lost", () => {
    const [bar] = addPart([], "bar");
    const file = joinParts(blank, [{ ...bar, additions: [bar.additions[0], withRule({ additions: [bar.additions[1]] }, opacity).additions[0]] }]);
    const split = splitParts(file);
    expect(split.parts.map((p) => p.pattern)).not.toContain("bar");
    expect(joinParts(split.base, split.parts)).toEqual(file);
  });

  it("setAdditionRules writes one addition's rules as given (the pattern's too); a visible rule starts it hidden", () => {
    const [bar] = addPart([], "bar");
    const [width] = bar.additions[1].tokenData.propDeps;
    const visible = { objectProperty: "visible", type: "bool", source: "card", dtoProperty: "shown" };
    const next = setAdditionRules(bar, 1, [width, visible]);
    expect(next.additions[1].tokenData.propDeps).toEqual([width, visible]);
    expect(next.additions[1].visible).toBe(false);
    expect(next.additions[0]).toEqual(bar.additions[0]);
    const cleared = setAdditionRules(next, 1, []);
    expect(cleared.additions[1].tokenData).not.toHaveProperty("propDeps");
    expect(cleared.additions[1]).not.toHaveProperty("visible");
  });

  it("setPartRules writes the rules on every addition and keeps the pattern's", () => {
    const [bar] = addPart([], "bar");
    const next = setPartRules({ ...bar, rules: [] }, [opacity]);
    expect(next.rules).toEqual([opacity]);
    expect(next.additions.map((a) => a.tokenData.propDeps.map((d) => d.objectProperty))).toEqual([["opacity"], ["width", "fill", "opacity"]]);
    expect(setPartRules(next, []).additions[1].tokenData.propDeps.map((d) => d.objectProperty)).toEqual(["width", "fill"]);
  });

  it("custom parts: the rules all their additions share are its own; the others stay", () => {
    const shared = { objectProperty: "angle", type: "number", source: "card", dtoProperty: "facing" };
    const onlyOne = { objectProperty: "fill", type: "string", source: "card", dtoProperty: "colour" };
    const file = { ...blank, additions: [
      { name: "odd_a", type: "triangle", tokenData: { propDeps: [onlyOne, shared] } },
      { name: "odd_b", type: "triangle", tokenData: { propDeps: [shared] } },
    ] };
    const [part] = splitParts(file).parts;
    expect(part.pattern).toBe("custom");
    expect(part.rules).toEqual([shared]);
    const next = setPartRules(part, [opacity]);
    expect(next.additions.map((a) => a.tokenData.propDeps)).toEqual([[onlyOne, opacity], [opacity]]);
  });

  it("a rule on visible starts the part hidden (as the game does); taking it away shows it again", () => {
    const visible = { objectProperty: "visible", type: "bool", source: "card", dtoProperty: "status_marked" };
    const [label] = addPart([], "label");
    const hidden = setPartRules({ ...label, rules: [] }, [visible]);
    expect(hidden.additions[0].visible).toBe(false);
    expect(setPartRules(hidden, []).additions[0]).not.toHaveProperty("visible");
    // A button is hidden by its own pattern: taking a visible rule away leaves that.
    const [button] = addPart([], "button");
    const shown = setPartRules(setPartRules({ ...button, rules: [] }, [visible]), []);
    expect(shown.additions[0].visible).toBe(false);
  });

  it("the dnd5e token still reads the same, with no rules of its own", () => {
    const { parts } = splitParts(character);
    expect(parts.map((p) => p.pattern)).toEqual(["bar", "label", "button", "iconSet", "iconSet"]);
    expect(parts.every((p) => p.rules.length === 0)).toBe(true);
  });
});
