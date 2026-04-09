import * as React from "react";
import {
  Badge,
  Box,
  Flex,
  Icon,
  IconButton,
  Input,
  Separator,
  Text,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { JSONTree } from "react-json-tree";
import {
  FaBroom,
  FaBug,
  FaEye,
  FaPlay,
  FaSkull,
  FaStop,
  FaTerminal,
} from "react-icons/fa";
import { MdSkipNext, MdInput } from "react-icons/md";

import { Tooltip } from "../../../ui/tooltip";
import Subscribable from "../../../uiComponents/base/Subscribable";
import DockableHelper from "../../../../helpers/DockableHelper";
import LookupPanel from "./LookupPanel";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import { ResizeDivider, useDragResize } from "../../../uiComponents/ResizeDivider";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG_SURFACE  = "rgb(28,28,28)";
const BG_RAISED   = "rgb(38,38,38)";
const BORDER_CLR  = "rgb(65,65,65)";
const TEXT_MUTED  = "rgb(130,130,130)";
const CLR_GOLD    = "rgb(220,180,60)";
const CLR_BLUE    = "rgb(100,150,230)";
const CLR_RED     = "rgb(220,80,80)";
const CLR_GREEN   = "rgb(80,200,120)";

// ── JSON theme (matches dark surface) ────────────────────────────────────────
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
  base0A: CLR_GOLD,
  base0B: CLR_GREEN,
  base0C: "rgb(80,200,200)",
  base0D: CLR_BLUE,
  base0E: "rgb(180,100,220)",
  base0F: "rgb(200,100,100)",
};

// ── ColumnHeader ──────────────────────────────────────────────────────────────
const ColumnHeader = React.memo(({ title, count, onClear, icon }) => (
  <Flex
    direction="row"
    alignItems="center"
    px="10px"
    py="7px"
    borderBottomWidth="1px"
    borderColor={BORDER_CLR}
    flexShrink={0}
    gap="6px"
  >
    <Icon as={icon} color={TEXT_MUTED} boxSize="12px" />
    <Text fontSize="12px" fontWeight="bold" color="var(--nordvik-text-color)" flex={1}>
      {title}
    </Text>
    {count > 0 && (
      <Badge fontSize="10px" bg="rgb(55,55,55)" color={TEXT_MUTED} borderRadius="full" px="6px">
        {count}
      </Badge>
    )}
    <Tooltip content="Clear" openDelay={300}>
      <IconButton
        size="xs"
        variant="ghost"
        color={TEXT_MUTED}
        aria-label={`Clear ${title}`}
        onClick={onClear}
        _hover={{ color: CLR_RED }}
      >
        <Icon as={FaBroom} />
      </IconButton>
    </Tooltip>
  </Flex>
));

// ── MessageRow ────────────────────────────────────────────────────────────────
const MessageRow = React.memo(({ label, sublabel, timestamp, onInspect, highlight, error }) => (
  <Flex
    direction="row"
    alignItems="center"
    px="10px"
    py="5px"
    gap="8px"
    borderBottomWidth="1px"
    borderColor={error ? "rgb(80,30,30)" : "rgb(50,50,50)"}
    bg={error ? "rgb(40,20,20)" : undefined}
    _hover={{ bg: error ? "rgb(55,25,25)" : "rgb(48,52,60)" }}
    flexShrink={0}
  >
    <Text
      fontSize="10px"
      color={TEXT_MUTED}
      fontFamily="mono"
      flexShrink={0}
      minW="54px"
    >
      {timestamp}
    </Text>
    <Flex direction="column" flex={1} overflow="hidden">      <Text
        fontSize="12px"
        color={error ? CLR_RED : highlight ? CLR_GOLD : "var(--nordvik-text-color)"}
        fontFamily="mono"
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        {label}
      </Text>
      {sublabel && (
        <Text fontSize="11px" color={TEXT_MUTED} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
          {sublabel}
        </Text>
      )}
    </Flex>
    {onInspect && (
      <Tooltip content="Inspect" openDelay={300}>
        <IconButton
          size="xs"
          variant="ghost"
          color={TEXT_MUTED}
          aria-label="Inspect"
          flexShrink={0}
          onClick={onInspect}
          _hover={{ color: CLR_BLUE }}
        >
          <Icon as={FaEye} />
        </IconButton>
      </Tooltip>
    )}
  </Flex>
));

// ── VariableRow ───────────────────────────────────────────────────────────────
const VariableRow = React.memo(({ name, value, onInspect }) => {
  const [expanded, setExpanded] = React.useState(false);
  const isObject = typeof value === "object" && value !== null;

  return (
    <Box
      borderBottomWidth="1px"
      borderColor="rgb(50,50,50)"
      _hover={{ bg: "rgb(44,48,56)" }}
    >
      <Flex
        direction="row"
        alignItems="center"
        px="10px"
        py="5px"
        gap="8px"
        cursor={isObject ? "pointer" : "default"}
        onClick={isObject ? () => setExpanded((p) => !p) : undefined}
      >
        {isObject && (
          <Text fontSize="10px" color={TEXT_MUTED} flexShrink={0} w="10px">
            {expanded ? "▾" : "▸"}
          </Text>
        )}
        <Text fontSize="12px" color={CLR_BLUE} fontFamily="mono" flexShrink={0} minW="80px">
          {name}
        </Text>
        {!isObject && (
          <Text fontSize="12px" color={CLR_GREEN} fontFamily="mono" flex={1} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {String(value)}
          </Text>
        )}
        {isObject && !expanded && (
          <Text fontSize="11px" color={TEXT_MUTED} flex={1} fontFamily="mono">
            {"{…}"}
          </Text>
        )}
        {isObject && (
          <Tooltip content="Open in inspector" openDelay={300}>
            <IconButton
              size="xs"
              variant="ghost"
              color={TEXT_MUTED}
              aria-label="Inspect"
              flexShrink={0}
              onClick={(e) => { e.stopPropagation(); onInspect(); }}
              _hover={{ color: CLR_BLUE }}
            >
              <Icon as={FaEye} />
            </IconButton>
          </Tooltip>
        )}
      </Flex>
      {isObject && expanded && (
        <Box px="10px" pb="6px">
          <JSONTree data={value} theme={JSON_THEME} invertTheme={false} hideRoot />
        </Box>
      )}
    </Box>
  );
});

// ── State badge colours ───────────────────────────────────────────────────────
const STATE_COLORS = {
  Running:  { bg: "rgb(30,60,30)",  border: "rgb(80,180,80)",  text: "rgb(80,200,120)"  },
  Paused:   { bg: "rgb(60,50,20)",  border: CLR_GOLD,          text: CLR_GOLD           },
  Finished: { bg: "rgb(30,40,55)",  border: CLR_BLUE,          text: CLR_BLUE           },
  Faulted:  { bg: "rgb(50,20,20)",  border: CLR_RED,           text: CLR_RED            },
  Killed:   { bg: "rgb(40,30,40)",  border: "rgb(150,80,180)", text: "rgb(180,100,220)" },
};

// ── RunningActionsBar ─────────────────────────────────────────────────────────
// Polls addon/RunningActions every 2 s while mounted and visible.
const RunningActionsBar = React.memo(({ onSupplyInput }) => {  const [actions,      setActions]      = React.useState([]);
  const [collapsed,    setCollapsed]    = React.useState(false);
  const [supplyTarget, setSupplyTarget] = React.useState(null); // { runId, token }
  const [inputValue,   setInputValue  ] = React.useState("");
  const [confirmKill,  setConfirmKill ] = React.useState(null); // runId awaiting confirm
  const mountedRef = React.useRef(true);

  // ── polling ────────────────────────────────────────────────────────────────
  const poll = React.useCallback(async () => {
    const data = await WebHelper.getAsync("addon/RunningActions");
    if (mountedRef.current && Array.isArray(data)) {
      setActions(data);
    }
  }, []);

  React.useEffect(() => {
    mountedRef.current = true;
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [poll]);
  // ── supply input ───────────────────────────────────────────────────────────
  const handleSupply = React.useCallback(async (token, value) => {
    let parsed = value;
    try { parsed = JSON.parse(value); } catch { /* send as string */ }
    await WebHelper.postAsync(`addon/SupplyInput?token=${token}`, parsed);
    setSupplyTarget(null);
    setInputValue("");
    poll(); // immediate refresh
  }, [poll]);

  // ── kill action ────────────────────────────────────────────────────────────
  const handleKill = React.useCallback(async (runId) => {
    await WebHelper.postAsync(`addon/KillAction?runId=${runId}`, null);
    poll(); // immediate refresh
  }, [poll]);

  const colSt = collapsed ? { maxH: "32px" } : {};

  return (
    <Flex
      direction="column"
      flexShrink={0}
      borderBottomWidth="1px"
      borderColor={BORDER_CLR}
      bg="rgb(32,32,32)"
      {...colSt}
      overflow="hidden"
      transition="max-height 0.2s"
    >
      {/* ── header row ── */}
      <Flex
        direction="row"
        alignItems="center"
        px="10px"
        py="5px"
        gap="6px"
        cursor="pointer"
        onClick={() => setCollapsed((p) => !p)}
        _hover={{ bg: "rgb(42,42,42)" }}
        flexShrink={0}
      >
        <Text fontSize="10px" color={TEXT_MUTED} w="10px">{collapsed ? "▸" : "▾"}</Text>
        <Text fontSize="11px" fontWeight="bold" color="var(--nordvik-text-color)" flex={1}
          textTransform="uppercase" letterSpacing="wider">
          Running Actions
        </Text>
        {actions.length > 0 && (
          <Badge fontSize="10px" bg="rgb(55,55,55)" color={TEXT_MUTED} borderRadius="full" px="6px">
            {actions.length}
          </Badge>
        )}
      </Flex>

      {/* ── action rows ── */}
      {!collapsed && (
        <Flex direction="column" maxH="160px" overflowY="auto">
          {actions.length === 0 && (
            <Flex align="center" justify="center" py="8px">
              <Text fontSize="11px" color={TEXT_MUTED} fontStyle="italic">No running actions</Text>
            </Flex>
          )}
          {actions.map((a) => {
            const clr = STATE_COLORS[a.state] ?? STATE_COLORS.Running;
            const isSupplyTarget = supplyTarget?.runId === a.runId;
            return (
              <Box key={a.runId}>
                <Flex
                  direction="row"
                  alignItems="center"
                  px="10px"
                  py="5px"
                  gap="8px"
                  borderTopWidth="1px"
                  borderColor="rgb(50,50,50)"
                  bg={clr.bg}
                  _hover={{ bg: clr.bg }}
                  flexShrink={0}
                >
                  {/* State badge */}
                  <Box
                    px="6px" py="1px"
                    borderRadius="full"
                    borderWidth="1px"
                    borderColor={clr.border}
                    flexShrink={0}
                  >
                    <Text fontSize="10px" color={clr.text} fontFamily="mono">{a.state}</Text>
                  </Box>

                  {/* Name + step */}
                  <Flex direction="column" flex={1} overflow="hidden">
                    <Text fontSize="12px" color="var(--nordvik-text-color)" fontFamily="mono"
                      overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                      {a.actionName}
                    </Text>
                    {a.currentStep != null && (
                      <Text fontSize="10px" color={TEXT_MUTED} fontFamily="mono">
                        step {a.currentStep}
                        {a.faultMessage && ` — ${a.faultMessage}`}
                      </Text>
                    )}
                  </Flex>

                  {/* Started time */}
                  <Text fontSize="10px" color={TEXT_MUTED} fontFamily="mono" flexShrink={0}>
                    {a.startedAt ? new Date(a.startedAt).toLocaleTimeString() : ""}
                  </Text>

                  {/* Supply input button — only when waiting on a token */}
                  {a.waitingOnToken && (
                    <Tooltip content="Supply input" openDelay={200}>
                      <IconButton
                        size="xs"
                        variant="outline"
                        borderColor={CLR_GOLD}
                        color={CLR_GOLD}
                        bg="rgb(50,40,10)"
                        aria-label="Supply input"
                        flexShrink={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSupplyTarget({ runId: a.runId, token: a.waitingOnToken });
                          setInputValue("");
                        }}
                        _hover={{ bg: "rgb(70,55,15)" }}
                      >
                        <Icon as={MdInput} />
                      </IconButton>
                    </Tooltip>
                  )}                  {/* Kill button — two-step confirm */}
                  {confirmKill === a.runId ? (
                    <Flex gap="4px" flexShrink={0} alignItems="center">
                      <Text fontSize="10px" color={CLR_RED} flexShrink={0}>Kill?</Text>
                      <Tooltip content="Confirm kill" openDelay={100}>
                        <IconButton
                          size="xs"
                          variant="solid"
                          bg="rgb(50,20,20)"
                          borderColor={CLR_RED}
                          borderWidth="1px"
                          color={CLR_RED}
                          aria-label="Confirm kill"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmKill(null);
                            handleKill(a.runId);
                          }}
                          _hover={{ bg: "rgb(70,25,25)" }}
                        >
                          <Icon as={FaSkull} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip content="Cancel" openDelay={100}>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          color={TEXT_MUTED}
                          aria-label="Cancel kill"
                          onClick={(e) => { e.stopPropagation(); setConfirmKill(null); }}
                          _hover={{ color: "var(--nordvik-text-color)" }}
                        >
                          <Icon as={FaStop} />
                        </IconButton>
                      </Tooltip>
                    </Flex>
                  ) : (
                    <Tooltip content="Kill action" openDelay={200}>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        color={TEXT_MUTED}
                        aria-label="Kill action"
                        flexShrink={0}
                        onClick={(e) => { e.stopPropagation(); setConfirmKill(a.runId); }}
                        _hover={{ color: CLR_RED }}
                      >
                        <Icon as={FaSkull} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Flex>

                {/* Inline supply-input form */}
                {isSupplyTarget && (
                  <Flex
                    direction="row"
                    alignItems="center"
                    gap="6px"
                    px="10px"
                    py="6px"
                    bg="rgb(40,35,10)"
                    borderTopWidth="1px"
                    borderColor={CLR_GOLD}
                    flexShrink={0}
                  >
                    <Icon as={MdInput} color={CLR_GOLD} boxSize="13px" flexShrink={0} />
                    <Text fontSize="11px" color={CLR_GOLD} flexShrink={0}>
                      Input for token{" "}
                      <Text as="span" fontFamily="mono" fontSize="10px">
                        {String(supplyTarget.token).slice(0, 8)}…
                      </Text>
                    </Text>
                    <Input
                      size="xs"
                      flex={1}
                      placeholder='value or JSON e.g. "hello" / 42 / {"key":"val"}'
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSupply(supplyTarget.token, inputValue);
                        if (e.key === "Escape") { setSupplyTarget(null); setInputValue(""); }
                      }}
                      bg="rgb(30,28,10)"
                      borderColor={CLR_GOLD}
                      color="var(--nordvik-text-color)"
                      _placeholder={{ color: TEXT_MUTED }}
                      fontFamily="mono"
                      autoFocus
                    />
                    <Tooltip content="Send (Enter)" openDelay={200}>
                      <IconButton
                        size="xs"
                        variant="solid"
                        bg="rgb(60,50,15)"
                        borderColor={CLR_GOLD}
                        borderWidth="1px"
                        color={CLR_GOLD}
                        aria-label="Send input"
                        onClick={() => handleSupply(supplyTarget.token, inputValue)}
                        _hover={{ bg: "rgb(80,65,20)" }}
                      >
                        <Icon as={MdSkipNext} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content="Cancel (Esc)" openDelay={200}>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        color={TEXT_MUTED}
                        aria-label="Cancel"
                        onClick={() => { setSupplyTarget(null); setInputValue(""); }}
                        _hover={{ color: CLR_RED }}
                      >
                        <Icon as={FaStop} />
                      </IconButton>
                    </Tooltip>
                  </Flex>
                )}
              </Box>
            );
          })}
        </Flex>
      )}
    </Flex>
  );
});

// ── DebugConsolePanel ─────────────────────────────────────────────────────────
export const DebugConsolePanel = ({ state, actionName: initialActionName }) => {
  const [incomingMessages, setIncomingMessages] = React.useState([]);
  const [debugMessages,    setDebugMessages   ] = React.useState([]);
  const [debugEnabled,     setDebugEnabled    ] = React.useState(false);  const [lastMessage,      setLastMessage     ] = React.useState(undefined);
  const [actionName,       setActionName      ] = React.useState(initialActionName ?? "");
  const [inputArguments,   setInputArguments  ] = React.useState("");

  // Scroll-to-bottom refs for each column
  const incomingEndRef = React.useRef(null);
  const debugEndRef    = React.useRef(null);
  // Resizable columns
  const colContainerRef = React.useRef(null);
  const { fracs, onDividerMouseDown } = useDragResize(colContainerRef, [1/3, 1/3]);

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Debug Console");

  // ── Initial state fetch ────────────────────────────────────────────────────
  React.useEffect(() => {
    WebSocketManagerInstance.Send({ command: "debug_mode_get" });
  }, []);

  // ── Auto-scroll each column when messages arrive ───────────────────────────
  React.useEffect(() => {
    incomingEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [incomingMessages]);

  React.useEffect(() => {
    debugEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debugMessages]);

  // ── WS message handler ─────────────────────────────────────────────────────
  const handleIncomingMessage = React.useCallback((response) => {
    const entry = {
      ...response,
      date: new Date().toLocaleTimeString(),
    };

    if (response.command.startsWith("debug")) {
      if (response.command.startsWith("debug_mode")) {
        setDebugEnabled(response.data);      } else {
        setDebugMessages((prev) => [...prev, entry]);
        if (entry.inputToken) {
          setLastMessage(entry);
        }
      }
    } else {
      setIncomingMessages((prev) => [...prev, entry]);
    }
  }, []);

  // ── Inspector popup ────────────────────────────────────────────────────────
  const showDetails = React.useCallback((message, name) => {
    DockableHelper.NewFloating(
      state,
      <LookupPanel
        name={name ?? `${message.date} — ${message.command}`}
        content={message}
      />
    );
  }, [state]);

  // ── Debug step controls ────────────────────────────────────────────────────
  const sendDebugResponse = React.useCallback((data) => {
    if (!lastMessage) return;
    WebSocketManagerInstance.Send({
      command: "debug_action_response",
      InputToken: lastMessage.inputToken,
      Data: data,
    });
    setLastMessage(undefined);
  }, [lastMessage]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const buildRunPayload = React.useCallback(() => {
    let args;
    if (inputArguments.trim()) {
      try { args = JSON.parse(inputArguments); } catch { args = inputArguments; }
    }
    return { Action: actionName.trim(), ...(args !== undefined && { Args: args }) };
  }, [actionName, inputArguments]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Subscribable onMessage={handleIncomingMessage} commandPrefix="" />

      <Flex direction="column" height="100%" bg={BG_SURFACE} overflow="hidden">

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <Flex
          direction="row"
          alignItems="center"
          gap="6px"
          px="10px"
          py="7px"
          borderBottomWidth="1px"
          borderColor={BORDER_CLR}
          bg={BG_RAISED}
          flexShrink={0}
          flexWrap="wrap"
        >          {/* Action runner */}
          <Icon as={FaTerminal} color={TEXT_MUTED} boxSize="13px" flexShrink={0} />
          <Input
            size="sm"
            placeholder="Action name…"
            value={actionName}
            onChange={(e) => setActionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && actionName.trim()) {
                WebSocketManagerInstance.Send({ command: "execute_action", data: buildRunPayload() });
              }
            }}
            w="160px"
            bg={BG_SURFACE}
            borderColor={BORDER_CLR}
            color="var(--nordvik-text-color)"
            _placeholder={{ color: TEXT_MUTED }}
            _focus={{ borderColor: CLR_BLUE, boxShadow: "none" }}
            fontFamily="mono"
            fontSize="12px"
          />
          <Input
            size="sm"
            placeholder="Args (JSON…)"
            value={inputArguments}
            onChange={(e) => setInputArguments(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && actionName.trim()) {
                WebSocketManagerInstance.Send({ command: "execute_action", data: buildRunPayload() });
              }
            }}
            w="180px"
            bg={BG_SURFACE}
            borderColor={BORDER_CLR}
            color="var(--nordvik-text-color)"
            _placeholder={{ color: TEXT_MUTED, fontSize: "11px" }}
            _focus={{ borderColor: CLR_BLUE, boxShadow: "none" }}
            fontFamily="mono"
            fontSize="12px"
          />
          <Tooltip content="Run action (Enter)" openDelay={300}>
            <IconButton
              size="sm"
              variant="outline"
              aria-label="Run action"
              borderColor={BORDER_CLR}
              color="var(--nordvik-text-color)"
              onClick={() => {
                if (!actionName.trim()) return;
                WebSocketManagerInstance.Send({ command: "execute_action", data: buildRunPayload() });
              }}
            >
              <Icon as={FaPlay} />
            </IconButton>
          </Tooltip>

          <Separator orientation="vertical" h="24px" borderColor={BORDER_CLR} />

          {/* Debug mode toggle */}
          <Tooltip content={debugEnabled ? "Debug mode ON — click to disable" : "Enable debug mode"} openDelay={300}>
            <IconButton
              size="sm"
              variant={debugEnabled ? "solid" : "outline"}
              aria-label="Toggle debug mode"
              borderColor={debugEnabled ? CLR_GOLD : BORDER_CLR}
              bg={debugEnabled ? "rgb(60,50,20)" : "transparent"}
              color={debugEnabled ? CLR_GOLD : TEXT_MUTED}
              onClick={() => {
                WebSocketManagerInstance.Send({
                  command: "debug_mode_set",
                  data: !debugEnabled,
                });
              }}
            >
              <Icon as={FaBug} />
            </IconButton>
          </Tooltip>

          {debugEnabled && (
            <Badge
              fontSize="10px"
              bg="rgb(60,50,20)"
              color={CLR_GOLD}
              borderRadius="full"
              px="8px"
              py="2px"
            >
              DEBUG ON
            </Badge>
          )}
        </Flex>

        {/* ── Debug step status bar (shown only when paused on a step) ──────── */}
        {debugEnabled && lastMessage && (
          <Flex
            direction="row"
            alignItems="center"
            gap="8px"
            px="12px"
            py="7px"
            borderBottomWidth="1px"
            borderColor={CLR_GOLD}
            bg="rgb(40,35,15)"
            flexShrink={0}
            flexWrap="wrap"
          >
            <Icon as={FaBug} color={CLR_GOLD} boxSize="13px" />
            <Text fontSize="12px" color={CLR_GOLD} fontWeight="bold" flexShrink={0}>
              Paused
            </Text>
            <Text fontSize="12px" color="var(--nordvik-text-color)" fontFamily="mono">
              {lastMessage?.data?.Step?.Type}
            </Text>
            {lastMessage?.data?.Message && (
              <Text fontSize="12px" color={TEXT_MUTED} flex={1} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                — {lastMessage.data.Message}
              </Text>
            )}
            <Flex gap="6px" ml="auto" flexShrink={0}>
              <Tooltip content="Continue execution" openDelay={300}>
                <IconButton
                  size="sm"
                  variant="solid"
                  bg="rgb(60,50,20)"
                  borderColor={CLR_GOLD}
                  borderWidth="1px"
                  color={CLR_GOLD}
                  aria-label="Continue"
                  onClick={() => sendDebugResponse("continue")}
                  _hover={{ bg: "rgb(80,65,20)" }}
                >
                  <Icon as={MdSkipNext} />
                </IconButton>
              </Tooltip>
              <Tooltip content="Stop action" openDelay={300}>
                <IconButton
                  size="sm"
                  variant="solid"
                  bg="rgb(50,25,25)"
                  borderColor={CLR_RED}
                  borderWidth="1px"
                  color={CLR_RED}
                  aria-label="Stop"
                  onClick={() => sendDebugResponse("stop")}
                  _hover={{ bg: "rgb(70,30,30)" }}
                >
                  <Icon as={FaStop} />
                </IconButton>
              </Tooltip>
            </Flex>
          </Flex>
        )}

        {/* ── Running Actions bar (polls every 2 s when debug is on) ──────── */}
        {debugEnabled && <RunningActionsBar />}

        {/* ── Three-column body ─────────────────────────────────────────────── */}
        <Flex flex={1} direction="row" overflow="hidden" gap={0} ref={colContainerRef}>

          {/* ── Incoming Messages ────────────────────────────────────────────── */}
          <Flex direction="column" width={`${fracs[0] * 100}%`} flexShrink={0} overflow="hidden">
            <ColumnHeader
              title="Incoming"
              count={incomingMessages.length}
              onClear={() => setIncomingMessages([])}
              icon={FaTerminal}
            />
            <Flex direction="column" flex={1} overflowY="auto">
              {incomingMessages.length === 0 && (
                <Flex flex={1} align="center" justify="center">
                  <Text fontSize="12px" color={TEXT_MUTED}>No messages</Text>
                </Flex>
              )}
              {incomingMessages.map((x, i) => (
                <MessageRow
                  key={i}
                  timestamp={x.date}
                  label={x.command}
                  sublabel={
                    typeof x.data === "object"
                      ? JSON.stringify(x.data).slice(0, 60)
                      : x.data != null ? String(x.data).slice(0, 60) : undefined
                  }
                  onInspect={() => showDetails(x)}
                />
              ))}              <div ref={incomingEndRef} />
            </Flex>
          </Flex>

          <ResizeDivider onMouseDown={(e) => onDividerMouseDown(0, e)} />

          {/* ── Debug Messages ───────────────────────────────────────────────── */}
          <Flex direction="column" width={`${fracs[1] * 100}%`} flexShrink={0} overflow="hidden">
            <ColumnHeader
              title="Debug Steps"
              count={debugMessages.length}
              onClear={() => { setDebugMessages([]); setLastMessage(undefined); }}
              icon={FaBug}
            />
            <Flex direction="column" flex={1} overflowY="auto">
              {debugMessages.length === 0 && (
                <Flex flex={1} align="center" justify="center">
                  <Text fontSize="12px" color={TEXT_MUTED}>No debug events</Text>
                </Flex>
              )}              {debugMessages.map((x, i) => {
                const hasError = Boolean(x?.data?.Error);
                return (
                  <MessageRow
                    key={i}
                    timestamp={x.date}
                    label={
                      hasError
                        ? x.data.Error
                        : `${x?.data?.Action?.Name ?? "?"} › ${x?.data?.Step?.Type ?? "?"}`
                    }
                    sublabel={!hasError ? x?.data?.Message : undefined}
                    highlight={x === lastMessage}
                    error={hasError}
                    onInspect={() => showDetails(x)}
                  />
                );
              })}              <div ref={debugEndRef} />
            </Flex>
          </Flex>

          <ResizeDivider onMouseDown={(e) => onDividerMouseDown(1, e)} />

          {/* ── Variables ────────────────────────────────────────────────────── */}
          <Flex direction="column" flex={1} overflow="hidden">
            <Flex
              direction="row"
              alignItems="center"
              px="10px"
              py="7px"
              borderBottomWidth="1px"
              borderColor={BORDER_CLR}
              flexShrink={0}
              gap="6px"
            >
              <Text fontSize="12px" fontWeight="bold" color="var(--nordvik-text-color)" flex={1}>
                Variables
              </Text>
              {lastMessage?.data?.Variables && (
                <Badge fontSize="10px" bg="rgb(55,55,55)" color={TEXT_MUTED} borderRadius="full" px="6px">
                  {Object.keys(lastMessage.data.Variables).length}
                </Badge>
              )}
              {lastMessage && (
                <Tooltip content="Inspect full step" openDelay={300}>
                  <IconButton
                    size="xs"
                    variant="ghost"
                    color={TEXT_MUTED}
                    aria-label="Inspect step"
                    onClick={() => showDetails(lastMessage, lastMessage?.data?.Step?.Type)}
                    _hover={{ color: CLR_BLUE }}
                  >
                    <Icon as={FaEye} />
                  </IconButton>
                </Tooltip>
              )}
            </Flex>

            <Flex direction="column" flex={1} overflowY="auto">
              {!lastMessage?.data?.Variables ? (
                <Flex flex={1} align="center" justify="center">
                  <Text fontSize="12px" color={TEXT_MUTED}>
                    {debugEnabled ? "Waiting for a paused step…" : "Enable debug mode to capture variables"}
                  </Text>
                </Flex>
              ) : (
                Object.keys(lastMessage.data.Variables).map((key) => (
                  <VariableRow
                    key={key}
                    name={key}
                    value={lastMessage.data.Variables[key]}
                    onInspect={() =>
                      showDetails(lastMessage.data.Variables[key], key)
                    }
                  />
                ))
              )}
            </Flex>
          </Flex>

        </Flex>
      </Flex>
    </>
  );
};

export default DebugConsolePanel;
