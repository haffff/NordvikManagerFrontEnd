import { describe, it, expect } from "vitest";
import { draftReducer, initialDraftState, isDirty, toPayload, stepOps } from "./useActionDraft";

const action = {
  id: "a1", prefix: "smoke", name: "compute", hook: 0,
  content: JSON.stringify([{ id: "s1", Type: "RollDice", Data: { DiceString: "1d20" } }, { Type: "Log", Data: {} }]),
};

const load = () => draftReducer(initialDraftState, { type: "load", action });
const setDice = (state, value, key = "s1.DiceString") =>
  draftReducer(state, {
    type: "edit", key,
    apply: (d) => ({ ...d, steps: d.steps.map((s) => (s.id === "s1" ? { ...s, Data: { ...s.Data, DiceString: value } } : s)) }),
  });

describe("draftReducer", () => {
  it("loads steps, fills missing ids and starts clean", () => {
    const s = load();
    expect(s.steps).toHaveLength(2);
    expect(s.steps[1].id).toBeTruthy();
    expect(isDirty(s)).toBe(false);
  });

  it("becomes dirty after an edit and clean again after save", () => {
    let s = setDice(load(), "2d6");
    expect(isDirty(s)).toBe(true);
    s = draftReducer(s, { type: "saved" });
    expect(isDirty(s)).toBe(false);
  });

  it("is clean again when an edit is undone", () => {
    let s = setDice(load(), "2d6");
    s = draftReducer(s, { type: "undo" });
    expect(isDirty(s)).toBe(false);
    expect(s.steps[0].Data.DiceString).toBe("1d20");
  });

  it("merges consecutive edits with the same key into one undo step", () => {
    let s = load();
    s = setDice(s, "2");
    s = setDice(s, "2d");
    s = setDice(s, "2d6");
    expect(s.past).toHaveLength(1);
    s = draftReducer(s, { type: "undo" });
    expect(s.steps[0].Data.DiceString).toBe("1d20");
  });

  it("starts a new undo step after breakMerge or a different key", () => {
    let s = setDice(load(), "2d6");
    s = draftReducer(s, { type: "breakMerge" });
    s = setDice(s, "3d6");
    s = setDice(s, "4d6", "other");
    expect(s.past).toHaveLength(3);
  });

  it("redoes what was undone, and a new edit clears redo", () => {
    let s = setDice(load(), "2d6");
    s = draftReducer(s, { type: "undo" });
    s = draftReducer(s, { type: "redo" });
    expect(s.steps[0].Data.DiceString).toBe("2d6");
    s = draftReducer(s, { type: "undo" });
    s = setDice(s, "9d9", "x");
    expect(s.future).toHaveLength(0);
  });

  it("serializes steps back into content", () => {
    const payload = toPayload(setDice(load(), "2d6"));
    expect(JSON.parse(payload.content)[0].Data.DiceString).toBe("2d6");
    expect(payload.prefix).toBe("smoke");
  });
});

describe("stepOps", () => {
  const steps = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("moves, inserts, duplicates and removes", () => {
    expect(stepOps.move(steps, "a", "c").map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(stepOps.insertAt(steps, 1, { id: "x" }).map((s) => s.id)).toEqual(["a", "x", "b", "c"]);
    const dup = stepOps.duplicate(steps, "b");
    expect(dup).toHaveLength(4);
    expect(dup[2].id).not.toBe("b");
    expect(stepOps.remove(steps, "b").map((s) => s.id)).toEqual(["a", "c"]);
  });
});
