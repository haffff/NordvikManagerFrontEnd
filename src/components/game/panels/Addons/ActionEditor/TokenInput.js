import * as React from "react";
import { Box, Input, Text, Textarea } from "@chakra-ui/react";
import { T } from "./editorTheme";
import { extractVariableRefs } from "./variableScope";

// Text field with %variable% autocomplete.
//  - Typing "%" (or "%na…") opens a list of variables available at this step.
//  - ↑/↓ choose, Enter/Tab insert "%name%", Esc closes.
//  - `mode="whole"` instead suggests complete values (used for action names).
// Tokens that aren't known at this point are listed under the field as a hint.

const SOURCE_LABEL = { builtin: "built-in", hook: "trigger", input: "input", step: "step" };
const MAX_ITEMS = 12;

// Returns { start, query } when the caret sits right after an unfinished "%query".
export function openTokenAt(text, caret) {
  const before = text.slice(0, caret);
  const pct = (before.match(/%/g) ?? []).length;
  if (pct % 2 === 0) return null;           // every % before the caret is already paired
  const start = before.lastIndexOf("%");
  const query = before.slice(start + 1);
  if (/[^\w:.{}[\]]/.test(query)) return null; // spaces etc. → not a token
  return { start, query };
}

export const SuggestList = ({ items, activeIndex, onPick, empty }) => (
  <Box
    position="absolute" zIndex={20} left={0} right={0} top="100%" mt="2px"
    bg={T.raised} borderWidth="1px" borderColor={T.border} borderRadius="md"
    boxShadow="lg" maxH="240px" overflowY="auto" py={1}
    onMouseDown={(e) => e.preventDefault()} // keep focus in the field
  >
    {items.length === 0 ? (
      <Text px={3} py={1} fontSize="xs" color={T.faint}>{empty ?? "No matches"}</Text>
    ) : items.map((it, i) => (
      <Box
        key={it.value} px={3} py="3px" cursor="pointer"
        bg={i === activeIndex ? T.selected : undefined}
        _hover={{ bg: T.hover }}
        onClick={() => onPick(it)}
        display="flex" gap={2} alignItems="baseline"
      >
        <Text fontSize="sm" fontFamily="mono" color={T.text} flex={1} truncate>{it.label ?? it.value}</Text>
        {it.hint && <Text fontSize="2xs" color={T.faint} flexShrink={0}>{it.hint}</Text>}
      </Box>
    ))}
  </Box>
);

export const TokenInput = React.forwardRef(function TokenInput({
  value, onChange, onBlur, multiline = false, rows = 3,
  variables = [],          // [{name, source}] available at this step
  knownNames,              // Set of names that won't be flagged (defaults to `variables`)
  mode = "token",          // "token" | "whole"
  options = [],            // for mode="whole": [{value, label, hint}]
  placeholder, fontFamily = "mono", ...rest
}, ref) {
  const inputRef = React.useRef(null);
  React.useImperativeHandle(ref, () => inputRef.current);
  const [menu, setMenu] = React.useState(null); // { start, query } | { whole: true }
  const [active, setActive] = React.useState(0);
  const text = value ?? "";

  const items = React.useMemo(() => {
    if (!menu) return [];
    if (menu.whole) {
      const q = text.toLowerCase();
      return options.filter((o) => o.value.toLowerCase().includes(q) || (o.label ?? "").toLowerCase().includes(q)).slice(0, MAX_ITEMS);
    }
    const q = menu.query.toLowerCase();
    const vars = variables
      .filter((v) => v.name.toLowerCase().includes(q))
      .map((v) => ({ value: v.name, label: `%${v.name}%`, hint: SOURCE_LABEL[v.source] ?? v.source }));
    const snippets = [
      { value: "v:", label: "%v:name.field%", hint: "value inside an object", snippet: "v:" },
      { value: "q:", label: "%q:{name}.prop%", hint: "property of an entity", snippet: "q:{" },
      { value: "dto:", label: "%dto:name%", hint: "as JSON", snippet: "dto:" },
    ].filter((s) => s.value.startsWith(q) || q === "");
    return [...vars.slice(0, MAX_ITEMS), ...snippets];
  }, [menu, text, variables, options]);

  React.useEffect(() => { setActive(0); }, [items.length]);

  const refresh = (nextText, caret) => {
    if (mode === "whole") { setMenu({ whole: true }); return; }
    setMenu(openTokenAt(nextText, caret));
  };

  const pick = (item) => {
    if (menu?.whole) {
      onChange(item.value);
      setMenu(null);
      return;
    }
    const el = inputRef.current;
    const caret = el?.selectionStart ?? text.length;
    const insert = item.snippet ? `%${item.snippet}` : `%${item.value}%`;
    const next = text.slice(0, menu.start) + insert + text.slice(caret);
    onChange(next);
    const pos = menu.start + insert.length;
    setMenu(item.snippet ? { start: menu.start, query: item.snippet } : null);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos, pos); });
  };

  const onKeyDown = (e) => {
    if (!menu || items.length === 0) {
      if (e.key === "ArrowDown" && mode === "whole") { setMenu({ whole: true }); e.preventDefault(); }
      return;
    }
    if (e.key === "ArrowDown") { setActive((a) => (a + 1) % items.length); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setActive((a) => (a - 1 + items.length) % items.length); e.preventDefault(); }
    else if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") { pick(items[active]); e.preventDefault(); }
    else if (e.key === "Escape") { setMenu(null); e.stopPropagation(); }
  };

  const known = knownNames ?? new Set(variables.map((v) => v.name));
  const unknown = mode === "token" ? extractVariableRefs(text).filter((n) => !known.has(n)) : [];

  const Field = multiline ? Textarea : Input;
  return (
    <Box position="relative">
      <Field
        ref={inputRef}
        size="sm"
        value={text}
        rows={multiline ? rows : undefined}
        placeholder={placeholder}
        fontFamily={fontFamily}
        borderColor={T.border}
        spellCheck={false}
        onChange={(e) => { onChange(e.target.value); refresh(e.target.value, e.target.selectionStart); }}
        onKeyDown={onKeyDown}
        onClick={(e) => mode === "token" && refresh(text, e.target.selectionStart)}
        onFocus={() => mode === "whole" && setMenu({ whole: true })}
        onBlur={(e) => { setMenu(null); onBlur?.(e); }}
        {...rest}
      />
      {menu && (items.length > 0 || menu.whole) && (
        <SuggestList items={items} activeIndex={active} onPick={pick} empty={menu.whole ? "Type any action name" : undefined} />
      )}
      {unknown.length > 0 && (
        <Text fontSize="2xs" color="orange.300" mt="2px">
          Not defined before this step: {unknown.map((n) => `%${n}%`).join(", ")}
        </Text>
      )}
    </Box>
  );
});

export default TokenInput;
