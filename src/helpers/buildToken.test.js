import { describe, it, expect } from "vitest";
import shared from "./token-build-cases.json";
import { buildToken } from "./buildToken";

// What a token file becomes on the map: the same cases as the server's BuildToken
// (token-build-cases.json is shared with NordvikManager-Backend), so the token editor's
// preview shows what placing the token will.
describe("buildToken", () => {
  it.each(shared.cases.map((c) => [c.name, c]))("%s", (_, c) => {
    expect(buildToken(c.template, c.options)).toEqual(c.expected);
  });

  it("leaves the token file as it was", () => {
    const template = shared.cases[3].template;
    const before = JSON.stringify(template);
    buildToken(template, { gridSize: 50, mapId: "m" });
    expect(JSON.stringify(template)).toBe(before);
  });
});
