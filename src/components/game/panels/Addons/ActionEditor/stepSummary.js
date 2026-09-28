// Turns a step into a one-line, human-readable summary for the step list.
//
// The backend sends a template per step type, e.g. "Roll {DiceString}[ → {OutputVariable}]":
//   {Arg}     is replaced with the step's value for that argument
//   [ ... ]   is an optional part, dropped when any {Arg} inside it is empty
// A required {Arg} that is empty shows as a "missing" marker so unfinished steps stand out.
// Steps without a template fall back to their first few filled arguments.

const MAX_VALUE_LENGTH = 48;
const FALLBACK_ARG_COUNT = 3;

const isEmpty = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

// Multi-line values (scripts, property lists) show their first line plus an ellipsis.
export function shortValue(value) {
  if (isEmpty(value)) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  text = lines[0] ?? "";
  const more = lines.length > 1;
  if (text.length > MAX_VALUE_LENGTH) return text.slice(0, MAX_VALUE_LENGTH - 1) + "…";
  return more ? text + " …" : text;
}

// Splits text into plain parts and %token% parts so tokens can be highlighted.
export function splitTokens(text, kind = "value") {
  const out = [];
  const re = /%[^%\s]+%/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind, text: text.slice(last, m.index) });
    out.push({ kind: "token", text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind, text: text.slice(last) });
  return out;
}

// Parses a template into parts: { text } | { arg } | { optional: [parts] }.
export function parseTemplate(template) {
  const parts = [];
  let i = 0;
  const readUntil = (stop) => {
    const group = [];
    let buf = "";
    const flush = () => { if (buf) { group.push({ text: buf }); buf = ""; } };
    while (i < template.length && !stop.includes(template[i])) {
      const c = template[i];
      if (c === "{") {
        const end = template.indexOf("}", i);
        if (end === -1) { buf += template.slice(i); i = template.length; break; }
        flush();
        group.push({ arg: template.slice(i + 1, end) });
        i = end + 1;
      } else if (c === "[" && !stop.includes("]")) {
        flush();
        i++;
        const inner = readUntil("]");
        i++; // skip ]
        group.push({ optional: inner });
      } else {
        buf += c;
        i++;
      }
    }
    flush();
    return group;
  };
  parts.push(...readUntil(""));
  return parts;
}

function renderParts(parts, data, out) {
  for (const p of parts) {
    if (p.text !== undefined) {
      out.push({ kind: "text", text: p.text });
    } else if (p.arg !== undefined) {
      const v = shortValue(data?.[p.arg]);
      if (v) out.push(...splitTokens(v));
      else out.push({ kind: "missing", text: p.arg });
    } else if (p.optional) {
      const args = p.optional.filter((x) => x.arg !== undefined).map((x) => x.arg);
      if (args.every((a) => !isEmpty(data?.[a]))) renderParts(p.optional, data, out);
    }
  }
}

// Merges neighbouring parts of the same kind so rendering produces few spans.
function merge(segments) {
  const out = [];
  for (const s of segments) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === s.kind && s.kind !== "token") prev.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/**
 * @param step {{Type:string, Data:object}}
 * @param def  step definition from the backend ({name, summary, arguments}) or undefined
 * @returns {{segments: {kind:'text'|'value'|'token'|'missing', text:string}[], text: string}}
 */
export function summarizeStep(step, def) {
  const data = step?.Data ?? {};
  let segments = [];

  if (def?.summary) {
    renderParts(parseTemplate(def.summary), data, segments);
  } else {
    const args = (def?.arguments ?? []).map((a) => a.name);
    const names = args.length ? args : Object.keys(data).filter((k) => k !== "Label" && k !== "Comment");
    const filled = names.filter((n) => !isEmpty(data[n])).slice(0, FALLBACK_ARG_COUNT);
    segments.push({ kind: "text", text: def?.name ?? step?.Type ?? "Step" });
    filled.forEach((n, i) => {
      segments.push({ kind: "text", text: i === 0 ? " · " : ", " });
      segments.push({ kind: "text", text: `${n} ` });
      segments.push(...splitTokens(shortValue(data[n])));
    });
  }

  segments = merge(segments.filter((s) => s.text !== ""));
  return { segments, text: segments.map((s) => (s.kind === "missing" ? `‹${s.text}›` : s.text)).join("") };
}

// "DiceString" → "Dice string", "OutputVariable" → "Output variable", "ParentId" → "Parent id".
export function humanizeArgName(name) {
  if (!name) return "";
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
