import { describe, it, expect } from "vitest";
import {
  extractVariableRefs, scriptReturnKeys, variablesDefinedBy, variablesAvailableAt, computeInputs, outputsOf,
} from "./variableScope";

const defs = {
  GetPropertyValue: { arguments: [{ name: "ParentId" }, { name: "PropertyName" }, { name: "Output", isOutput: true }] },
  RollDice: { arguments: [{ name: "DiceString" }, { name: "OutputVariable", isOutput: true }] },
  RunScript: { arguments: [{ name: "Script", type: "code" }, { name: "Output", isOutput: true }] },
  SendChat: { arguments: [{ name: "Message" }] },
  SetVariable: { arguments: [{ name: "Name", isOutput: true }, { name: "Value" }] },
  If: { arguments: [{ name: "Condition" }, { name: "Then", type: "steps" }, { name: "Else", type: "steps" }] },
  ForEach: { arguments: [{ name: "Collection" }, { name: "ItemName", isOutput: true }, { name: "Do", type: "steps" }] },
};

// dnd5e roll_attribute: called by name with cardId + attribute
const rollAttribute = [
  { id: "get", Type: "GetPropertyValue", Data: { ParentId: "%cardId%", PropertyName: "%attribute%_mod", Output: "modifier" } },
  { id: "roll", Type: "RollDice", Data: { DiceString: "1d20+(%modifier%)" } },
];

describe("extractVariableRefs", () => {
  it("finds plain, path and q: references", () => {
    expect(extractVariableRefs("%a% %b.c[0].d% %q:{e}.hp% %q:{f.cardId}.hp% %q:1234.hp% %q:card[Mr. Smith].hp%"))
      .toEqual(["a", "b", "e", "f"]);
  });

  it("doesn't read the old dto: and v: forms as variables", () => {
    expect(extractVariableRefs("%dto:x% %v:y.z%")).toEqual([]);
  });
});

describe("scriptReturnKeys", () => {
  it("reads shorthand and explicit keys", () => {
    expect(scriptReturnKeys("const x=1;\nreturn { hp, total: 2, 'mod': 3 };")).toEqual(["hp", "total", "mod"]);
  });
});

describe("variablesDefinedBy", () => {
  it("uses isOutput arguments", () => {
    expect(variablesDefinedBy(rollAttribute[0], defs.GetPropertyValue)).toEqual(["modifier"]);
  });

  it("ignores token-valued outputs", () => {
    expect(variablesDefinedBy({ Type: "RollDice", Data: { OutputVariable: "%x%" } }, defs.RollDice)).toEqual([]);
  });

  it("reads RunScript return keys when there is no Output", () => {
    const s = { Type: "RunScript", Data: { Script: "return { alive, total: 2 };" } };
    expect(variablesDefinedBy(s, defs.RunScript)).toEqual(["alive", "total"]);
    const withOutput = { Type: "RunScript", Data: { Script: "return { alive };", Output: "res" } };
    expect(variablesDefinedBy(withOutput, defs.RunScript)).toEqual(["res"]);
  });
});

describe("variablesAvailableAt", () => {
  it("includes built-ins, hook variables, inputs and earlier outputs only", () => {
    const at1 = variablesAvailableAt(rollAttribute, "roll", defs, ["Data"], ["cardId"]).map((v) => `${v.source}:${v.name}`);
    expect(at1).toContain("builtin:playerId");
    expect(at1).toContain("hook:Data");
    expect(at1).toContain("input:cardId");
    expect(at1).toContain("step:modifier");
    const at0 = variablesAvailableAt(rollAttribute, "get", defs).map((v) => v.name);
    expect(at0).not.toContain("modifier");
  });

  // Blocks share the action's variables: what a block sets is there after it, and a
  // loop's item is there inside its Do.
  it("sees into blocks", () => {
    const steps = [
      { id: "if", Type: "If", Data: { Condition: "1 = 1", Then: [{ id: "set", Type: "SetVariable", Data: { Name: "hp", Value: "5" } }] } },
      { id: "loop", Type: "ForEach", Data: { Collection: "list", ItemName: "item", Do: [{ id: "inside", Type: "SendChat", Data: { Message: "%item%" } }] } },
      { id: "after", Type: "SendChat", Data: { Message: "%hp%" } },
    ];
    expect(variablesAvailableAt(steps, "after", defs).map((v) => v.name)).toEqual(expect.arrayContaining(["hp", "item"]));
    expect(variablesAvailableAt(steps, "inside", defs).map((v) => v.name)).toContain("item");
    expect(computeInputs(steps, defs)).toEqual([]); // hp and item are set inside the action
  });
});

describe("computeInputs", () => {
  it("lists names a called-by-name action expects from its caller", () => {
    expect(computeInputs(rollAttribute, defs)).toEqual(["cardId", "attribute"]);
  });

  it("does not list built-ins, hook variables or defined names", () => {
    const steps = [{ Type: "SendChat", Data: { Message: "%playerName% %ChatArgs% %x%" } }];
    expect(computeInputs(steps, defs, ["ChatArgs"])).toEqual(["x"]);
  });

  it("does not read RunScript source as tokens", () => {
    const steps = [{ Type: "RunScript", Data: { Script: "return { v: 17 % 5 % 2 };" } }];
    expect(computeInputs(steps, defs)).toEqual([]);
  });
});

// What a step's output variables hold, from the shapes the backend declares — shown under
// the step and in the variables panel.
describe("outputsOf", () => {
  const findDef = {
    value: "Find",
    arguments: [
      { name: "What" }, { name: "First" },
      { name: "Output", isOutput: true, output: { kind: "list", fields: [], fieldsBy: "What", fieldsByValue: { tokens: ["id", "name", "cardId"], cards: ["id", "name"] }, singleWhen: "First" } },
    ],
  };
  const rollDef = {
    value: "RollDice",
    arguments: [{ name: "SimpleOutput" }, { name: "OutputVariable", isOutput: true, output: { kind: "object", fields: ["result", "rolled"], valueWhen: "SimpleOutput" } }],
  };
  const forEachDef = {
    value: "ForEach",
    arguments: [{ name: "Collection" }, { name: "ItemName", isOutput: true, output: { kind: "item", fields: [], itemOf: "Collection" } }],
  };

  it("a list with the fields its kind has", () => {
    expect(outputsOf({ Type: "Find", Data: { What: "tokens", Output: "targets" } }, findDef))
      .toEqual([{ name: "targets", kind: "list", fields: ["id", "name", "cardId"] }]);
  });

  it("one item when First is on", () => {
    expect(outputsOf({ Type: "Find", Data: { What: "cards", First: true, Output: "card" } }, findDef))
      .toEqual([{ name: "card", kind: "object", fields: ["id", "name"] }]);
  });

  it("a plain value when the step says so", () => {
    expect(outputsOf({ Type: "RollDice", Data: { SimpleOutput: true, OutputVariable: "dmg" } }, rollDef))
      .toEqual([{ name: "dmg", kind: "value", fields: [] }]);
    expect(outputsOf({ Type: "RollDice", Data: { OutputVariable: "roll" } }, rollDef))
      .toEqual([{ name: "roll", kind: "object", fields: ["result", "rolled"] }]);
  });

  it("a loop's item has the fields of the list's items", () => {
    const shapes = { targets: { kind: "list", fields: ["id", "name"] } };
    expect(outputsOf({ Type: "ForEach", Data: { Collection: "targets", ItemName: "t" } }, forEachDef, shapes))
      .toEqual([{ name: "t", kind: "object", fields: ["id", "name"] }]);
  });

  it("nothing for an output named with a token", () => {
    expect(outputsOf({ Type: "Find", Data: { What: "tokens", Output: "%x%" } }, findDef)).toEqual([]);
  });
});

describe("variablesAvailableAt with shapes", () => {
  it("gives each step variable what it holds, a loop's item its list's fields", () => {
    const shaped = {
      ...defs,
      Find: { arguments: [{ name: "What" }, { name: "Output", isOutput: true, output: { kind: "list", fields: [], fieldsBy: "What", fieldsByValue: { tokens: ["id", "name"] } } }] },
      ForEach: { arguments: [{ name: "Collection" }, { name: "ItemName", isOutput: true, output: { kind: "item", fields: [], itemOf: "Collection" } }, { name: "Do", type: "steps" }] },
    };
    const steps = [
      { id: "find", Type: "Find", Data: { What: "tokens", Output: "targets" } },
      { id: "loop", Type: "ForEach", Data: { Collection: "targets", ItemName: "t", Do: [{ id: "in", Type: "SendChat", Data: { Message: "x" } }] } },
    ];

    const at = Object.fromEntries(variablesAvailableAt(steps, "in", shaped).map((v) => [v.name, v]));

    expect([at.targets.kind, at.targets.fields]).toEqual(["list", ["id", "name"]]);
    expect([at.t.kind, at.t.fields]).toEqual(["object", ["id", "name"]]);
    expect(at.playerName.kind).toBe("value");
  });
});
