import * as React from "react";
import {
  Badge,
  Box,
  Flex,
  Icon,
  IconButton,
  Text,
  Select,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { JSONTree } from "react-json-tree";
import { FaBroom, FaEye } from "react-icons/fa";
import { MdRefresh } from "react-icons/md";
import { Tooltip } from "../../../ui/tooltip";
import { BasePanel } from "../../../uiComponents/base/BasePanel";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";

// ── Design tokens (match DebugConsolePanel) ───────────────────────────────────
const BG_SURFACE = "rgb(28,28,28)";
const BG_RAISED  = "rgb(38,38,38)";
const BORDER_CLR = "rgb(65,65,65)";
const TEXT_MUTED = "rgb(130,130,130)";
const CLR_RED    = "rgb(220,80,80)";
const CLR_YELLOW = "rgb(220,180,60)";
const CLR_GREEN  = "rgb(80,200,120)";
const CLR_BLUE   = "rgb(100,150,230)";

const JSON_THEME = {
  scheme: "nordvik",
  base00: "transparent",
  base01: BG_RAISED,
  base02: BORDER_CLR,
  base03: TEXT_MUTED,
  base04: TEXT_MUTED,
  base05: "rgb(200,200,200)",
  base06: "rgb(220,220,220)",
  base07: "white",
  base08: CLR_RED,
  base09: "rgb(210,140,60)",
  base0A: CLR_YELLOW,
  base0B: CLR_GREEN,
  base0C: "rgb(80,200,200)",
  base0D: CLR_BLUE,
  base0E: "rgb(180,100,220)",
  base0F: "rgb(200,100,100)",
};

const LEVEL_COLORS = {
  Error:   CLR_RED,
  Warning: CLR_YELLOW,
  Info:    CLR_GREEN,
};

const LEVEL_BG = {
  Error:   "rgba(220,80,80,0.15)",
  Warning: "rgba(220,180,60,0.12)",
  Info:    "transparent",
};

// ── EntryRow ──────────────────────────────────────────────────────────────────
const EntryRow = React.memo(({ entry, onInspect }) => {
  const color  = LEVEL_COLORS[entry.level] ?? TEXT_MUTED;
  const bg     = LEVEL_BG[entry.level]     ?? "transparent";
  const ts     = new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <Flex
      direction="row"
      alignItems="flex-start"
      px="10px"
      py="6px"
      gap="8px"
      borderBottomWidth="1px"
      borderColor={entry.level === "Error" ? "rgb(80,30,30)" : "rgb(50,50,50)"}
      bg={bg}
      _hover={{ bg: entry.level === "Error" ? "rgb(55,25,25)" : "rgb(44,48,56)" }}
      flexShrink={0}
    >
      {/* Timestamp */}
      <Text fontSize="10px" color={TEXT_MUTED} fontFamily="mono" flexShrink={0} minW="62px" mt="2px">
        {ts}
      </Text>

      {/* Level badge */}
      <Badge
        fontSize="9px"
        px="5px"
        py="1px"
        borderRadius="full"
        flexShrink={0}
        color={color}
        bg={LEVEL_BG[entry.level] || "rgba(100,100,100,0.2)"}
        border={`1px solid ${color}`}
        mt="1px"
        minW="52px"
        textAlign="center"
      >
        {entry.level}
      </Badge>

      {/* Category badge */}
      <Badge
        fontSize="9px"
        px="5px"
        py="1px"
        borderRadius="full"
        flexShrink={0}
        color={TEXT_MUTED}
        bg="rgba(100,100,100,0.15)"
        border={`1px solid ${BORDER_CLR}`}
        mt="1px"
        minW="52px"
        textAlign="center"
      >
        {entry.category}
      </Badge>

      {/* Message + player */}
      <Flex direction="column" flex={1} overflow="hidden">
        <Text
          fontSize="12px"
          color={color}
          fontFamily="mono"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {entry.message}
        </Text>
        {entry.player && (
          <Text fontSize="10px" color={TEXT_MUTED}>
            by {entry.player}
          </Text>
        )}
      </Flex>

      {/* Inspect details */}
      {entry.details && (
        <Tooltip content="Inspect details" openDelay={300}>
          <IconButton
            size="xs"
            variant="ghost"
            color={TEXT_MUTED}
            aria-label="Inspect"
            flexShrink={0}
            onClick={() => onInspect(entry)}
            _hover={{ color: CLR_BLUE }}
          >
            <Icon as={FaEye} />
          </IconButton>
        </Tooltip>
      )}
    </Flex>
  );
});

// ── EventLogPanel ─────────────────────────────────────────────────────────────
export const EventLogPanel = ({ state }) => {
  const [entries,    setEntries]    = React.useState([]);
  const [sinceId,    setSinceId]    = React.useState(null);
  const [levelFilter,   setLevelFilter]   = React.useState("All");
  const [categoryFilter, setCategoryFilter] = React.useState("All");
  const [inspected,  setInspected]  = React.useState(null);
  const listRef = React.useRef(null);
  const autoScrollRef = React.useRef(true);

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Event Log");

  // ── Poll for new entries ───────────────────────────────────────────────────
  const fetchEntries = React.useCallback(async (currentSinceId) => {
    const path = currentSinceId
      ? `addon/eventlog?sinceId=${currentSinceId}`
      : "addon/eventlog";
    const data = await WebHelper.getAsync(path);
    if (!Array.isArray(data) || data.length === 0) return;

    setEntries(prev => {
      const next = [...prev, ...data];
      // Keep at most 500 entries on the frontend
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
    setSinceId(data[data.length - 1].id);
  }, []);

  // Initial load
  React.useEffect(() => {
    fetchEntries(null);
  }, [fetchEntries]);

  // Polling interval
  React.useEffect(() => {
    const id = setInterval(() => {
      fetchEntries(sinceId);
    }, 5000);
    return () => clearInterval(id);
  }, [fetchEntries, sinceId]);

  // Auto-scroll to bottom when new entries arrive
  React.useEffect(() => {
    if (autoScrollRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleClear = async () => {
    await WebHelper.deleteAsync("addon/eventlog");
    setEntries([]);
    setSinceId(null);
    setInspected(null);
  };

  const handleRefresh = () => {
    setEntries([]);
    setSinceId(null);
    fetchEntries(null);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const visible = React.useMemo(() => entries.filter(e => {
    if (levelFilter !== "All"    && e.level    !== levelFilter)    return false;
    if (categoryFilter !== "All" && e.category !== categoryFilter) return false;
    return true;
  }), [entries, levelFilter, categoryFilter]);

  const categories = React.useMemo(() => {
    const s = new Set(entries.map(e => e.category));
    return ["All", ...Array.from(s).sort()];
  }, [entries]);

  const parsedDetails = React.useMemo(() => {
    if (!inspected?.details) return null;
    try { return JSON.parse(inspected.details); } catch { return inspected.details; }
  }, [inspected]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <BasePanel>
      <Flex direction="column" height="100%" overflow="hidden" bg={BG_SURFACE}>

        {/* Toolbar */}
        <Flex
          direction="row"
          alignItems="center"
          px="10px"
          py="6px"
          borderBottomWidth="1px"
          borderColor={BORDER_CLR}
          flexShrink={0}
          gap="8px"
        >
          <Text fontSize="12px" fontWeight="bold" color="var(--nordvik-text-color)" flex={1}>
            Event Log
          </Text>

          {/* Error count badge */}
          {entries.filter(e => e.level === "Error").length > 0 && (
            <Badge fontSize="10px" bg="rgba(220,80,80,0.2)" color={CLR_RED} borderRadius="full" px="6px">
              {entries.filter(e => e.level === "Error").length} error{entries.filter(e => e.level === "Error").length !== 1 ? "s" : ""}
            </Badge>
          )}

          {/* Level filter */}
          <select
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
            style={{
              background: BG_RAISED,
              color: "var(--nordvik-text-color)",
              border: `1px solid ${BORDER_CLR}`,
              borderRadius: "4px",
              fontSize: "11px",
              padding: "2px 4px",
            }}
          >
            {["All", "Error", "Warning", "Info"].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              background: BG_RAISED,
              color: "var(--nordvik-text-color)",
              border: `1px solid ${BORDER_CLR}`,
              borderRadius: "4px",
              fontSize: "11px",
              padding: "2px 4px",
            }}
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <Tooltip content="Refresh" openDelay={300}>
            <IconButton size="xs" variant="ghost" color={TEXT_MUTED} aria-label="Refresh" onClick={handleRefresh} _hover={{ color: CLR_BLUE }}>
              <Icon as={MdRefresh} />
            </IconButton>
          </Tooltip>

          <Tooltip content="Clear log" openDelay={300}>
            <IconButton size="xs" variant="ghost" color={TEXT_MUTED} aria-label="Clear" onClick={handleClear} _hover={{ color: CLR_RED }}>
              <Icon as={FaBroom} />
            </IconButton>
          </Tooltip>
        </Flex>

        {/* Entry list */}
        <Box
          ref={listRef}
          flex={1}
          overflowY="auto"
          overflowX="hidden"
          onScroll={e => {
            const el = e.currentTarget;
            autoScrollRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
          }}
        >
          {visible.length === 0 && (
            <Flex alignItems="center" justifyContent="center" height="100px">
              <Text fontSize="12px" color={TEXT_MUTED}>No events logged yet.</Text>
            </Flex>
          )}
          {visible.map(entry => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onInspect={setInspected}
            />
          ))}
        </Box>

        {/* Details inspector (shown when an entry is clicked) */}
        {inspected && (
          <Flex
            direction="column"
            flexShrink={0}
            maxH="180px"
            borderTopWidth="1px"
            borderColor={BORDER_CLR}
            bg={BG_RAISED}
            overflow="hidden"
          >
            <Flex
              direction="row"
              alignItems="center"
              px="10px"
              py="5px"
              borderBottomWidth="1px"
              borderColor={BORDER_CLR}
              gap="6px"
            >
              <Text fontSize="11px" fontWeight="bold" color="var(--nordvik-text-color)" flex={1}>
                Details — {inspected.message?.slice(0, 60)}
              </Text>
              <IconButton
                size="xs"
                variant="ghost"
                color={TEXT_MUTED}
                aria-label="Close details"
                onClick={() => setInspected(null)}
                _hover={{ color: CLR_RED }}
              >
                ×
              </IconButton>
            </Flex>
            <Box overflow="auto" flex={1} px="4px" py="4px" fontSize="11px">
              {parsedDetails !== null
                ? <JSONTree data={parsedDetails} theme={JSON_THEME} invertTheme={false} hideRoot />
                : <Text color={TEXT_MUTED} fontFamily="mono" fontSize="11px">{inspected.details}</Text>
              }
            </Box>
          </Flex>
        )}
      </Flex>
    </BasePanel>
  );
};

export default EventLogPanel;
