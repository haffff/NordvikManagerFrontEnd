import * as React from "react";
import { Badge, Box, Flex, Input, Text } from "@chakra-ui/react";
import { DialogRoot, DialogContent, DialogBody } from "../../../../ui/dialog";
import { T, categoryColor } from "./editorTheme";

// "Add step" palette: type to search step names, descriptions and categories;
// ↑/↓ + Enter to pick. Recently used step types are listed first.

const RECENT_KEY = "nm.actionEditor.recentSteps";
const RECENT_MAX = 6;

const readRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
};
const pushRecent = (type) => {
  try {
    const next = [type, ...readRecent().filter((t) => t !== type)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage unavailable: recents are a convenience only */ }
};

// Ranks a definition against the query: name hits first, then category, then description.
export function rankSteps(defs, query) {
  const q = query.trim().toLowerCase();
  if (!q) return defs;
  const score = (d) => {
    const name = (d.name ?? "").toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.includes(q) || (d.value ?? "").toLowerCase().includes(q)) return 1;
    if ((d.category ?? "").toLowerCase().includes(q)) return 2;
    if ((d.description ?? "").toLowerCase().includes(q)) return 3;
    return -1;
  };
  return defs
    .map((d) => ({ d, s: score(d) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.d.name.localeCompare(b.d.name))
    .map((x) => x.d);
}

export const StepPicker = ({ open, onClose, onPick, stepDefinitions }) => {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef(null);

  React.useEffect(() => { if (open) { setQuery(""); setActive(0); } }, [open]);

  // Flat, ordered list: recents (when not searching), then by category or by rank.
  const items = React.useMemo(() => {
    const defs = Array.isArray(stepDefinitions) ? stepDefinitions : [];
    if (query.trim()) return rankSteps(defs, query).map((d) => ({ d, group: null }));
    const recent = readRecent().map((t) => defs.find((d) => d.value === t)).filter(Boolean);
    const byCat = [...defs].sort((a, b) =>
      (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name));
    return [
      ...recent.map((d) => ({ d, group: "Recently used" })),
      ...byCat.map((d) => ({ d, group: d.category ?? "Other" })),
    ];
  }, [stepDefinitions, query, open]);

  React.useEffect(() => { setActive(0); }, [query]);
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (d) => { pushRecent(d.value); onPick(d); onClose(); };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { setActive((a) => Math.min(a + 1, items.length - 1)); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setActive((a) => Math.max(a - 1, 0)); e.preventDefault(); }
    else if (e.key === "Enter" && items[active]) { choose(items[active].d); e.preventDefault(); }
  };

  let lastGroup = null;
  return (
    <DialogRoot lazyMount size="md" open={open} onOpenChange={(e) => { if (!e.open) onClose(); }}>
      <DialogContent bg={T.surface} borderColor={T.border} borderWidth="1px">
        <DialogBody p={2}>
          <Input
            autoFocus size="sm" placeholder="Search steps… (e.g. roll, property, chat)"
            value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
            borderColor={T.border} mb={2}
          />
          <Box ref={listRef} maxH="420px" overflowY="auto">
            {items.length === 0 && <Text fontSize="sm" color={T.faint} px={2} py={3}>No step matches “{query}”.</Text>}
            {items.map(({ d, group }, i) => {
              const header = group && group !== lastGroup ? group : null;
              lastGroup = group;
              return (
                <React.Fragment key={`${group}-${d.value}`}>
                  {header && (
                    <Text fontSize="2xs" color={T.muted} textTransform="uppercase" letterSpacing="wider" px={2} pt={2} pb="2px">
                      {header}
                    </Text>
                  )}
                  <Flex
                    data-idx={i} px={2} py="5px" gap={2} borderRadius="md" cursor="pointer" align="baseline"
                    bg={i === active ? T.selected : undefined} _hover={{ bg: T.hover }}
                    onMouseEnter={() => setActive(i)} onClick={() => choose(d)}
                  >
                    <Badge size="sm" variant="subtle" colorPalette={categoryColor(d.category)} flexShrink={0}>{d.category}</Badge>
                    <Box minW={0}>
                      <Text fontSize="sm" color={T.text}>{d.name}</Text>
                      {i === active && d.description && (
                        <Text fontSize="xs" color={T.muted}>{d.description}</Text>
                      )}
                    </Box>
                  </Flex>
                </React.Fragment>
              );
            })}
          </Box>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};

export default StepPicker;
