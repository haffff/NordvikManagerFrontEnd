import validate from "./tokenSchemaValidator";

// The token file checked against the token schema (token.schema.json, compiled ahead of
// time by scripts/tokens/build-validator.mjs: the CSP forbids compiling it here).

/** @returns {{ path, message, part? }[]} empty when the file is fine; part = the part's name */
export function validateToken(definition) {
  if (validate(definition)) return [];
  return validate.errors.map((error) => {
    const path = error.instancePath || "/";
    const index = /^\/additions\/(\d+)/.exec(path)?.[1];
    const part = index !== undefined ? definition.additions?.[Number(index)]?.name : undefined;
    return { path, ...(part ? { part } : {}), message: error.message };
  });
}
