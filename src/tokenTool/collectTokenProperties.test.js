import { describe, it, expect } from "vitest";
import { collectTokenProperties } from "./collectTokenProperties";
import character from "./fixtures/token_character.json";

// The properties a token file reads, so the editor's preview can offer one sample input
// per property and show the token as it would look with those values.
const dep = (over) => ({ objectProperty: "text", type: "string", source: "card", ...over });
const part = (...propDeps) => ({ name: "p", type: "text", tokenData: { propDeps } });
const find = (list, name, source = "card") => list.find((p) => p.name === name && p.source === source);

describe("collectTokenProperties", () => {
  it("finds a part's plain property, with its kind from the dep's type", () => {
    const props = collectTokenProperties({ additions: [part(dep({ dtoProperty: "ac", type: "number" }))] });
    expect(props).toEqual([{ name: "ac", source: "card", kind: "number" }]);
  });

  it("every %prop% of an expression; a rule's values are numbers", () => {
    const props = collectTokenProperties({
      additions: [part(dep({ expression: "FromTo(%hp%, 0, %maxhp%, 0, 100)", objectProperty: "width", type: "number" }))],
    });
    expect(props).toEqual([
      { name: "hp", source: "card", kind: "number" },
      { name: "maxhp", source: "card", kind: "number" },
    ]);
  });

  it("a value table (Enum) looks up text: its property is text, whatever the part sets", () => {
    const props = collectTokenProperties({
      additions: [part(dep({ expression: 'Enum(%faction%, {"ally":"green"}, grey)', objectProperty: "fill" }), dep({ expression: 'Enum(%size%, {"1":"0.5"})', objectProperty: "opacity", type: "number" }))],
    });
    expect(props).toEqual([{ name: "faction", source: "card", kind: "text" }, { name: "size", source: "card", kind: "text" }]);
  });

  it("a property that shows or hides a part is a switch", () => {
    const props = collectTokenProperties({ additions: [part(dep({ dtoProperty: "status_x", objectProperty: "visible", type: "bool" }))] });
    expect(find(props, "status_x").kind).toBe("bool");
  });

  it("rule arguments naming properties, the token's own deps, quick-edit fields and icons", () => {
    const props = collectTokenProperties({
      tokenData: { propDeps: [dep({ dtoProperty: "faded", objectProperty: "opacity", type: "number", source: "element" })] },
      editableProps: [{ name: "show", dtoProperty: "show_bars", source: "element", type: "boolean" }, { name: "n", dtoProperty: "notes", source: "card" }],
      assignableIcons: [{ id: "x", iconPack: "gi", iconName: "GiX", dtoProperty: "status_y", source: "card" }],
      additions: [part(dep({ dtoProperty: "hp", type: "number", rule: { name: "FromTo", arguments: { valueMin: 0, valueMax: 1, propTargetMax: "maxhp" } } }))],
    });
    expect(find(props, "faded", "element").kind).toBe("number");
    expect(find(props, "show_bars", "element").kind).toBe("bool");
    expect(find(props, "notes").kind).toBe("text");
    expect(find(props, "status_y").kind).toBe("bool");
    expect(find(props, "maxhp").kind).toBe("number");
  });

  it("lists each property once, a switch winning over a number over text", () => {
    const props = collectTokenProperties({
      additions: [
        part(dep({ dtoProperty: "x" })),
        part(dep({ dtoProperty: "x", type: "number" })),
        part(dep({ dtoProperty: "x", objectProperty: "visible", type: "bool" })),
        part(dep({ dtoProperty: "x", source: "element" })),
      ],
    });
    expect(props).toEqual([{ name: "x", source: "card", kind: "bool" }, { name: "x", source: "element", kind: "text" }]);
  });

  it("leaves out the picture (the image is chosen separately) and disabled parts", () => {
    const props = collectTokenProperties({
      editableProps: [{ name: "img", dtoProperty: "tokenImage", source: "card", type: "image" }],
      additions: [{ ...part(dep({ dtoProperty: "gone" })), enabled: false }],
    });
    expect(props).toEqual([]);
  });

  it("the dnd5e character token: HP, name, conditions and counter icons", () => {
    const props = collectTokenProperties(character);
    expect(find(props, "hp").kind).toBe("number");
    expect(find(props, "maxhp").kind).toBe("number");
    expect(find(props, "character_name").kind).toBe("text");
    expect(find(props, "status_poisoned").kind).toBe("bool");
    expect(find(props, "dnd5e_icon_rage").kind).toBe("bool");
    expect(props.filter((p) => p.kind === "bool")).toHaveLength(16 + 20);
  });
});
