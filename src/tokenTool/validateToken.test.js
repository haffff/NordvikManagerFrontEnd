// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { validateToken } from "./validateToken";
import { validatorSource, SCHEMA_FILE, VALIDATOR_FILE } from "../../scripts/tokens/build-validator.mjs";
import character from "./fixtures/token_character.json";
import { PATTERNS } from "./patterns";
import { addPart, joinParts, updatePart } from "./patterns/parts";

// The token editor checks the file against the token schema (a copy of
// NordvikManager-Addons schemas/token.json), with a validator compiled ahead of time.
describe("validateToken", () => {
  it("the compiled validator is up to date with the schema (node scripts/tokens/build-validator.mjs)", () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));
    expect(fs.readFileSync(VALIDATOR_FILE, "utf8").replace(/\r\n/g, "\n")).toBe(validatorSource(schema));
  });

  it("the dnd5e character token is fine", () => {
    expect(validateToken(character)).toEqual([]);
  });

  it("every part the editor makes, scaled and turned, is fine", () => {
    let parts = [];
    for (const id of Object.keys(PATTERNS)) parts = addPart(parts, id);
    parts = parts.map((p) => updatePart(p, { ...p.params, ...("scale" in p.params ? { scale: 2 } : {}), ...("rotation" in p.params ? { rotation: 30 } : {}) }));
    const file = joinParts({ ...character, additions: [], assignableIcons: [] }, parts);
    expect(validateToken(file)).toEqual([]);
  });

  it("says where and what: a removed field, a missing name, a wrong type", () => {
    const problems = validateToken({ object: { clipShape: "circle" }, size: "big", additions: [] });
    expect(problems).toEqual(expect.arrayContaining([
      { path: "/", message: "must have required property 'name'" },
      { path: "/object/clipShape", message: expect.any(String) },
      { path: "/size", message: "must be integer" },
    ]));
  });

  it("names the part a problem is in", () => {
    const problems = validateToken({ name: "t", object: {}, additions: [{ name: "bar", tokenData: { anchor: "middle" } }] });
    expect(problems).toEqual([{ path: "/additions/0/tokenData/anchor", part: "bar", message: expect.stringMatching(/allowed values/) }]);
  });
});
