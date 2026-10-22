import { describe, it, expect, vi } from "vitest";

let next = 0;
vi.mock("../../../../../helpers/UtilityHelper", () => ({ default: { GenerateUUID: () => `new-${++next}` } }));

import { withIds, findStep, updateById, removeById, duplicateById, insertInto, moveWithin, stepPath, stepsBefore } from "./stepTree";

// An If whose Then holds a ForEach whose Do holds one step, then a step after the If.
const tree = () => [
  { id: "a", Type: "Log", Data: {} },
  {
    id: "if", Type: "If", Data: {
      Condition: "1 = 1",
      Then: [
        { id: "t1", Type: "SetVariable", Data: { Name: "x" } },
        { id: "loop", Type: "ForEach", Data: { Do: [{ id: "d1", Type: "Log", Data: {} }] } },
      ],
      Else: [{ id: "e1", Type: "Log", Data: {} }],
    },
  },
  { id: "z", Type: "Log", Data: {} },
];

describe("stepTree", () => {
  it("gives every step an id, inside blocks too", () => {
    const steps = withIds([{ Type: "If", Data: { Then: [{ Type: "Log", Data: {} }] } }]);
    expect(steps[0].id).toBeTruthy();
    expect(steps[0].Data.Then[0].id).toBeTruthy();
  });

  it("finds a step in a block, with where it sits", () => {
    const found = findStep(tree(), "d1");
    expect(found.step.Type).toBe("Log");
    expect(found.container).toEqual({ parentId: "loop", block: "Do" });
    expect(found.index).toBe(0);
    expect(findStep(tree(), "a").container).toBeNull();
  });

  it("updates, removes and duplicates at any depth", () => {
    const updated = updateById(tree(), "d1", (s) => ({ ...s, Data: { Message: "hi" } }));
    expect(findStep(updated, "d1").step.Data.Message).toBe("hi");

    const removed = removeById(tree(), "t1");
    expect(findStep(removed, "t1")).toBeNull();
    expect(removed[1].Data.Then).toHaveLength(1);

    const duplicated = duplicateById(tree(), "loop");
    const then = duplicated[1].Data.Then;
    expect(then).toHaveLength(3);
    expect(then[2].Type).toBe("ForEach");
    expect(then[2].id).not.toBe("loop");
    expect(then[2].Data.Do[0].id).not.toBe("d1"); // the copy's own steps get new ids too
  });

  it("inserts at the top or into a block", () => {
    const top = insertInto(tree(), null, 1, { id: "n", Type: "Log", Data: {} });
    expect(top.map((s) => s.id)).toEqual(["a", "n", "if", "z"]);

    const inElse = insertInto(tree(), { parentId: "if", block: "Else" }, 0, { id: "n", Type: "Log", Data: {} });
    expect(inElse[1].Data.Else.map((s) => s.id)).toEqual(["n", "e1"]);

    const newBlock = insertInto([{ id: "if", Type: "If", Data: {} }], { parentId: "if", block: "Then" }, 0, { id: "n", Type: "Log", Data: {} });
    expect(newBlock[0].Data.Then.map((s) => s.id)).toEqual(["n"]);
  });

  it("reorders within one list, and not across lists", () => {
    const moved = moveWithin(tree(), "loop", "t1");
    expect(moved[1].Data.Then.map((s) => s.id)).toEqual(["loop", "t1"]);
    expect(moveWithin(tree(), "d1", "a")).toEqual(tree());
  });

  it("gives the path the server reports a step's trace under", () => {
    expect(stepPath(tree(), "z")).toBe("2");
    expect(stepPath(tree(), "d1")).toBe("1/Then/1/Do/0");
    expect(stepPath(tree(), "e1")).toBe("1/Else/0");
  });

  it("lists the steps that run before a step, blocks included, for its variables", () => {
    expect(stepsBefore(tree(), "z").map((s) => s.id)).toEqual(["a", "if", "t1", "loop", "d1", "e1"]);
    expect(stepsBefore(tree(), "d1").map((s) => s.id)).toEqual(["a", "if", "t1", "loop"]);
  });
});
