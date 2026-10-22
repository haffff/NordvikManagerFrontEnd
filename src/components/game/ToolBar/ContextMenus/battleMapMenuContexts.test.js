import { describe, it, expect } from "vitest";
import { battleMapMenuContexts } from "./battleMapMenuContexts";

// What addon menu items on the map get as variables when clicked.
describe("battleMapMenuContexts", () => {
  const where = { battleMapId: "bm", mapId: "map", position: { x: 1, y: 2 } };

  it("gives every map menu the view, the map and the click", () => {
    const contexts = battleMapMenuContexts({ ...where, selected: [] });

    expect(contexts.battlemap).toEqual(where);
    expect(contexts.battlemap_add).toEqual(where);
  });

  it("gives the element menu the clicked element and every selected one", () => {
    const contexts = battleMapMenuContexts({ ...where, selected: [{ id: "a" }, { id: "b" }] });

    expect(contexts.battlemap_element).toEqual({ ...where, elementId: "a", elementIds: ["a", "b"] });
  });
});
