import { describe, it, expect } from "vitest";
import { parseListValue } from "./PropertiesSettingsPanel";

describe("parseListValue", () => {
  it("returns an empty array for an empty list", () => {
    expect(parseListValue("[]")).toEqual([]);
  });

  it("parses a well-shaped list of {id, fields} rows", () => {
    const value = JSON.stringify([{ id: "a1", fields: { name: "Hunt" } }]);
    expect(parseListValue(value)).toEqual([{ id: "a1", fields: { name: "Hunt" } }]);
  });

  it("returns null for a non-list plain string value", () => {
    expect(parseListValue("Hard")).toBeNull();
  });

  it("returns null for a plain numeric string", () => {
    expect(parseListValue("42")).toBeNull();
  });

  it("returns null for invalid JSON that merely starts with '['", () => {
    expect(parseListValue("[not valid json")).toBeNull();
  });

  it("returns null for an array of primitives, not {id, fields} rows", () => {
    expect(parseListValue(JSON.stringify([1, 2, 3]))).toBeNull();
  });

  it("returns null for an array of objects missing id/fields", () => {
    expect(parseListValue(JSON.stringify([{ foo: "bar" }]))).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(parseListValue(null)).toBeNull();
    expect(parseListValue(undefined)).toBeNull();
    expect(parseListValue(42)).toBeNull();
  });
});
