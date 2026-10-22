// An action pasted as JSON: one exported from the editor, an addon's action file, or what an
// AI assistant wrote (often inside a ```json fence, around some prose). Gives
// { action: { prefix, name, hook, description, content } } or { error } saying what's wrong.

const unfence = (text) => {
  const fenced = /```(?:json)?\s*\n([\s\S]*?)```/i.exec(text);
  return (fenced ? fenced[1] : text).trim();
};

const isStep = (s) => s && typeof s === "object" && !Array.isArray(s);

// Step types used anywhere in the steps, inside If / ForEach blocks too.
const typesIn = (steps, into = new Set()) => {
  for (const s of steps) {
    into.add(s.Type);
    for (const v of Object.values(s.Data ?? {})) {
      if (Array.isArray(v) && v.length > 0 && v.every((x) => isStep(x) && "Type" in x)) typesIn(v, into);
    }
  }
  return into;
};

/** knownTypes: the step types the server has (omit to skip that check). */
export function parseActionJson(text, knownTypes) {
  let value;
  try { value = JSON.parse(unfence(text ?? "")); } catch (e) { return { error: `Not valid JSON: ${e.message}` }; }

  const source = Array.isArray(value) ? { content: value } : value;
  if (!isStep(source)) return { error: "Expected an action: { \"name\", \"hook\", \"content\": [steps] }." };

  let content = source.content;
  if (typeof content === "string") {
    try { content = JSON.parse(content); } catch { return { error: "\"content\" is text that isn't a JSON list of steps." }; }
  }
  if (!Array.isArray(content)) return { error: "Missing \"content\": the list of steps." };
  if (!content.every(isStep)) return { error: "Every step must be an object: { \"Type\", \"Data\" }." };
  if (content.some((s) => typeof s.Type !== "string" || !s.Type)) return { error: "Every step needs a \"Type\"." };

  if (knownTypes) {
    const known = new Set(knownTypes);
    const unknown = [...typesIn(content)].filter((t) => !known.has(t));
    if (unknown.length) return { error: `No such step: ${unknown.join(", ")}. See the step reference.` };
  }

  const hook = parseInt(source.hook ?? 0, 10);
  return {
    action: {
      prefix: typeof source.prefix === "string" ? source.prefix : "",
      name: typeof source.name === "string" ? source.name : "",
      hook: Number.isNaN(hook) ? 0 : hook,
      description: typeof source.description === "string" ? source.description : "",
      content,
    },
  };
}
