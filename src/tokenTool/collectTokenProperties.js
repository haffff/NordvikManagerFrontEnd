import { extractPropNames, isExpressionDep } from "../helpers/TokenExpressionEvaluator";

// The properties a token file reads — its parts' and its own propDeps (plain, expression
// and rule-argument references), quick-edit fields and assignable icons — so the token
// editor's preview can offer one sample input per property.

const RANK = { text: 0, number: 1, bool: 2 };
// The picture comes from the editor's image chooser, not a sample value.
const PICTURE = "tokenImage";

const depKind = (dep) => (dep.objectProperty === "visible" || dep.type === "bool" ? "bool" : dep.type === "number" ? "number" : "text");

/** @returns {{ name, source, kind: "text"|"number"|"bool" }[]} in the order first read */
export function collectTokenProperties(definition) {
  const found = new Map();
  const add = (name, source, kind) => {
    if (!name || !source || name === PICTURE) return;
    const key = `${source}\u0000${name}`;
    const known = found.get(key);
    if (!known) found.set(key, { name, source, kind });
    else if (RANK[kind] > RANK[known.kind]) known.kind = kind;
  };

  const readDeps = (deps) => {
    for (const dep of deps ?? []) {
      if (isExpressionDep(dep)) {
        // A rule call (FromTo, FromToEnum, Math) works on numbers, but a value table
        // (Enum) looks up text; a plain substitution takes the dep's own type.
        const call = /^\s*(\w+)\(/.exec(dep.expression)?.[1];
        const kind = !call ? depKind(dep) : depKind(dep) === "bool" ? "bool" : call === "Enum" ? "text" : "number";
        for (const name of extractPropNames(dep.expression)) add(name, dep.source, kind);
        continue;
      }
      add(dep.dtoProperty, dep.source, depKind(dep));
      const args = dep.rule?.arguments ?? {};
      for (const ref of [args.propTargetMin, args.propTargetMax]) if (typeof ref === "string") add(ref, dep.source, "number");
    }
  };

  readDeps(definition.tokenData?.propDeps);
  for (const element of definition.additions ?? []) {
    if (element.enabled === false) continue;
    readDeps(element.tokenData?.propDeps);
  }
  for (const field of definition.editableProps ?? []) {
    if (field.type === "image") continue;
    add(field.dtoProperty, field.source, field.type === "boolean" ? "bool" : "text");
  }
  for (const icon of definition.assignableIcons ?? []) add(icon.dtoProperty, icon.source, "bool");

  return [...found.values()];
}
