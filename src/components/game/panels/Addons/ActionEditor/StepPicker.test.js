import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../ui/dialog", () => ({}));
import { rankSteps } from "./StepPicker";

// Finding a step by what you want to do, not by its name: "monsters" finds Find.
describe("rankSteps", () => {
  const defs = [
    { value: "Find", name: "Find", category: "Data", description: "Finds the game's things.", keywords: ["tokens", "monsters", "targets"] },
    { value: "RollDice", name: "Roll Dice", category: "Dice", description: "Rolls dice.", keywords: ["random", "damage"] },
    { value: "SendChat", name: "Send Chat", category: "Chat", description: "Posts a message about damage." },
  ];

  it("finds a step by its keywords", () => {
    expect(rankSteps(defs, "monsters").map((d) => d.value)).toEqual(["Find"]);
  });

  it("puts keyword hits before description hits", () => {
    expect(rankSteps(defs, "damage").map((d) => d.value)).toEqual(["RollDice", "SendChat"]);
  });
});
