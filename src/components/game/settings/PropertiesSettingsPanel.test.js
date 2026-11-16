import { describe, it, expect } from "vitest";
import { parseListValue } from "./PropertiesSettingsPanel";

describe("parseListValue", () => {
  it.each([
    ["an empty list", "[]", []],
    ["a well-shaped list of {id, fields} rows", JSON.stringify([{ id: "a1", fields: { name: "Hunt" } }]), [{ id: "a1", fields: { name: "Hunt" } }]],
  ])("parses %s", (_name, value, expected) => {
    expect(parseListValue(value)).toEqual(expected);
  });

  it.each([
    ["a non-list plain string value", "Hard"],
    ["a plain numeric string", "42"],
    ["invalid JSON that merely starts with '['", "[not valid json"],
    ["an array of primitives, not {id, fields} rows", JSON.stringify([1, 2, 3])],
    ["an array of objects missing id/fields", JSON.stringify([{ foo: "bar" }])],
    ["non-string input (null)", null],
    ["non-string input (undefined)", undefined],
    ["non-string input (a number)", 42],
  ])("returns null for %s", (_name, value) => {
    expect(parseListValue(value)).toBeNull();
  });

});
