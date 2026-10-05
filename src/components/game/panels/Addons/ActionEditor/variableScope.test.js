import { describe, it, expect } from "vitest";
import {
  extractVariableRefs, scriptReturnKeys, variablesDefinedBy, variablesAvailableAt, computeInputs,
} from "./variableScope";

const defs = {
  GetPropertyValue: { arguments: [{ name: "ParentId" }, { name: "PropertyName" }, { name: "Output", isOutput: true }] },
  RollDice: { arguments: [{ name: "DiceString" }, { name: "OutputVariable", isOutput: true }] },
  RunScript: { arguments: [{ name: "Script", type: "code" }, { name: "Output", isOutput: true }] },
  QueryData: { arguments: [{ name: "Assignments" }] },
  SendChat: { arguments: [{ name: "Message" }] },
};

// dnd5e roll_attribute: called by name with cardId + attribute
const rollAttribute = [
  { Type: "GetPropertyValue", Data: { ParentId: "%cardId%", PropertyName: "%attribute%_mod", Output: "modifier" } },
  { Type: "RollDice", Data: { DiceString: "1d20+(%modifier%)" } },
];

describe("extractVariableRefs", () => {
  it("finds plain, dto, v: and q: references", () => {
    expect(extractVariableRefs("%a% %dto:b% %v:c.d[0]% %q:{e}.hp% %q:1234.hp% %qn:card-\"x\".hp%"))
      .toEqual(["a", "b", "c", "e"]);
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

  it("reads Assign Variables lines", () => {
    const s = { Type: "QueryData", Data: { Assignments: "a=1\n b = %x%\nbad line\n=nope" } };
    expect(variablesDefinedBy(s, defs.QueryData)).toEqual(["a", "b"]);
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
    const at1 = variablesAvailableAt(rollAttribute, 1, defs, ["Data"], ["cardId"]).map((v) => `${v.source}:${v.name}`);
    expect(at1).toContain("builtin:playerId");
    expect(at1).toContain("hook:Data");
    expect(at1).toContain("input:cardId");
    expect(at1).toContain("step:modifier");
    const at0 = variablesAvailableAt(rollAttribute, 0, defs).map((v) => v.name);
    expect(at0).not.toContain("modifier");
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
