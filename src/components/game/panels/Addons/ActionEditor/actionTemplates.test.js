import { describe, it, expect } from "vitest";
import { ACTION_TEMPLATES } from "./actionTemplates";

// Templates to start a new action from: the patterns GMs ask for most, each self-contained
// (no helper actions it calls by name), built only from steps the server has.
describe("ACTION_TEMPLATES", () => {
  const types = (steps) => steps.flatMap((s) => [s.Type, ...Object.values(s.Data).filter(Array.isArray).flatMap(types)]);

  it("offers the four patterns", () => {
    expect(ACTION_TEMPLATES.map((t) => t.key)).toEqual(["targets", "area", "randomCard", "damageAll"]);
  });

  it("each has a label, a description and steps, and calls no other action", () => {
    for (const t of ACTION_TEMPLATES) {
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.content.length).toBeGreaterThan(0);
      expect(types(t.content)).not.toContain("ExecuteAction");
    }
  });

  it("picks targets with RequestTargets and shows the area with ShowMarker", () => {
    expect(types(ACTION_TEMPLATES.find((t) => t.key === "targets").content)).toContain("RequestTargets");
    expect(types(ACTION_TEMPLATES.find((t) => t.key === "area").content)).toEqual(expect.arrayContaining(["Find", "ShowMarker", "RequestUserInput"]));
  });
});
