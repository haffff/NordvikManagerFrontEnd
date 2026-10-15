// A chat template field shown as text. Strings and numbers pass through; anything
// else (an object, an array) becomes its JSON, since React can't render it as a
// child and would throw.
export function asText(value) {
  if (value == null || typeof value === "string" || typeof value === "number") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
