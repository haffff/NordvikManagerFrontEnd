import * as React from "react";
import {
  Box,
  Flex,
  Icon,
  IconButton,
  Separator,
  Text,
  Textarea,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaSearch } from "@react-icons/all-files/fa/FaSearch";
import { FaPaperPlane } from "@react-icons/all-files/fa/FaPaperPlane";
import { FaDiceD20 } from "@react-icons/all-files/fa/FaDiceD20";
import { Tooltip } from "../../ui/tooltip";
import { PopoverRoot, PopoverTrigger, PopoverContent, PopoverBody } from "../../ui/popover";
import DiceRoller from "../dice/DiceRoller";
import ChatSearch from "../chat/ChatSearch";

import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import Subscribable from "../../uiComponents/base/Subscribable";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import PlayerAvatar from "../../uiComponents/PlayerAvatar";
import ClientMediator from "../../../ClientMediator";
import UtilityHelper from "../../../helpers/UtilityHelper";
import CommandExecutionHelper from "../../../helpers/CommandExecutionHelper";
import { ChatMessageContent } from "../../../helpers/chatTemplates/ChatMessageContent";
import themeColors from "../../../helpers/themeColors";
import { describePrivacy } from "../../../helpers/chatPrivacy";
import { getChatSuggestions } from "../../../helpers/chatAutocomplete";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG_SURFACE = themeColors.surface;
const BG_RAISED  = themeColors.surfaceRaised;
const BORDER_CLR = themeColors.border;
const TEXT_MUTED = themeColors.textMuted;


// Live-pushed chat messages (chat_push) carry no persisted id, and history loaded
// from battlemap/getchat gets prepended/appended around them as the user scrolls —
// so `items` array *positions* are not stable across renders. Stamping a key once,
// at the moment an item first enters state, is what lets React key each ChatBubble
// by identity instead of by position: without this, using the array index as key
// (items.map((item, i) => <ChatBubble key={i} .../>)) causes every new incoming
// message (prepended to the front) to shift every other message's key by one,
// so React reassigns each ChatBubble instance's props onto a *different* message
// while keeping its old internal state (e.g. a chat roll's clicked/disabled
// "Roll Damage" button) — the "some messages allow rolling, some don't" bug.
// MessageDTO has no explicit [JsonPropertyName] pinning, so REST vs WS casing for
// its Id field isn't guaranteed — check both rather than assume one.
// Exported for direct unit testing — otherwise module-private.
export const stampKey  = (item) => ({ ...item, _reactKey: item?.id ?? item?.Id ?? UtilityHelper.GenerateUUID() });
export const stampKeys = (items) => (items ?? []).map(stampKey);

// ── Command autocompletion ────────────────────────────────────────────────────
// Parses the textarea value whenever it starts with "/c " and shows a floating
// suggestion list above the compose bar.

const CMD_PREFIX = "/c ";

/** Derives autocompletion state from the current textarea value. */
function parseCommandInput(value) {
  if (!value.startsWith(CMD_PREFIX)) return null;
  const raw   = value.slice(CMD_PREFIX.length);
  const parts = raw.split(/\s+/);
  return { raw, query: parts[0], args: parts.slice(1) };
}

// Floating list of matching commands
const CommandSuggestionList = React.memo(
  ({ suggestions, activeIndex, onSelect, argHint }) => {
    if (suggestions.length === 0 && !argHint) return null;

    return (
      <Box
        position="absolute"
        bottom="100%"
        left={0}
        right={0}
        mb="4px"
        borderRadius="6px"
        borderWidth="1px"
        borderColor={BORDER_CLR}
        bg={themeColors.background}
        boxShadow="0 -4px 16px rgba(0,0,0,0.5)"
        zIndex={100}
        maxH="220px"
        overflowY="auto"
      >
        {/* Argument hint bar — shown when a command is fully typed */}
        {argHint && (
          <Flex
            px="10px"
            py="6px"
            borderBottomWidth={suggestions.length > 0 ? "1px" : "0"}
            borderColor={BORDER_CLR}
            gap="6px"
            alignItems="center"
            flexWrap="wrap"
          >
            <Text fontSize="11px" color="rgb(100,140,220)" fontWeight="bold" mr="4px">
              {argHint.label}
            </Text>
            {argHint.args.map((a, i) => (
              <Box
                key={i}
                px="6px"
                py="1px"
                borderRadius="4px"
                bg={a.required ? "rgb(55,65,85)" : "rgb(42,42,42)"}
                borderWidth="1px"
                borderColor={a.required ? "rgb(80,100,140)" : BORDER_CLR}
                fontSize="11px"
                color={a.required ? "rgb(160,190,255)" : TEXT_MUTED}
              >
                {a.required ? `<${a.name}>` : `[${a.name}]`}
                {a.type && a.type !== "string" && (
                  <Text as="span" fontSize="10px" color="rgb(90,110,150)" ml="2px">
                    :{a.type}
                  </Text>
                )}
              </Box>
            ))}
            {argHint.description && (
              <Text fontSize="11px" color={TEXT_MUTED} ml="auto" fontStyle="italic" noOfLines={1}>
                {argHint.description}
              </Text>
            )}
          </Flex>
        )}

        {/* Suggestion rows */}
        {suggestions.map((s, i) => {
          const isActive = i === activeIndex;
          return (
            <Flex
              key={s.key ?? `${s.panel}.${s.command}`}
              px="10px"
              py="6px"
              alignItems="baseline"
              gap="8px"
              cursor="pointer"
              bg={isActive ? "rgb(45,55,75)" : "transparent"}
              borderLeftWidth="2px"
              borderColor={isActive ? "rgb(100,140,220)" : "transparent"}
              _hover={{ bg: "rgb(40,48,65)" }}
              onMouseDown={(e) => { e.preventDefault(); onSelect(s); }}
            >
              <Text fontSize="12px" color="rgb(160,190,255)" fontFamily="mono" flexShrink={0}>
                {s.label ?? `${s.panel}.${s.command}`}
              </Text>
              {s.description && (
                <Text fontSize="11px" color={TEXT_MUTED} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                  {s.description}
                </Text>
              )}
            </Flex>
          );
        })}
      </Box>
    );
  }
);

/**
 * Hook that drives command autocompletion.
 * Returns { listProps, handleKeyDown, argHint } to be spread / consumed by ChatPanel.
 */
function useCommandAutocomplete(message, setMessage, textareaRef, players, meId) {
  const [suggestions,  setSuggestions ] = React.useState([]);
  const [activeIndex,  setActiveIndex ] = React.useState(0);
  const [argHint,      setArgHint     ] = React.useState(null);
  const loadedRef = React.useRef(false);

  // Re-compute suggestions whenever message changes
  React.useEffect(() => {
    const parsed = parseCommandInput(message);

    if (!parsed) {
      // Chat commands ("/gr", "/w" …) and player names after "/w ".
      const chatSuggestions = getChatSuggestions(message, { players, meId }) ?? [];
      setSuggestions(chatSuggestions);
      setArgHint(null);
      setActiveIndex(0);
      return;
    }

    // Lazy-load suggestions once
    if (!loadedRef.current) {
      CommandExecutionHelper.LoadSuggestions();
      loadedRef.current = true;
    }

    const { query } = parsed;
    const hasSpace = message.slice(CMD_PREFIX.length).includes(" ");

    if (hasSpace) {
      // Command already chosen — show argument hint instead of list
      const exact = CommandExecutionHelper._suggestions.find(
        (s) => `${s.panel}.${s.command}`.toLowerCase() === query.toLowerCase() ||
               s.command.toLowerCase() === query.toLowerCase()
      );
      setSuggestions([]);
      setArgHint(
        exact
          ? {
              label:       `${exact.panel}.${exact.command}`,
              args:        exact.args ?? [],
              description: exact.description ?? "",
            }
          : null
      );
    } else {
      // Still typing the command name — filter suggestions
      const results = query
        ? CommandExecutionHelper.GetSuggestions(query)
        : CommandExecutionHelper._suggestions.slice(0, 12);
      setSuggestions(results.slice(0, 12));
      setArgHint(null);
      setActiveIndex(0);
    }
  }, [message, players, meId]);

  const open = suggestions.length > 0 || argHint !== null;

  const applySelection = React.useCallback(
    (suggestion) => {
      setMessage(suggestion.insert ?? `${CMD_PREFIX}${suggestion.panel}.${suggestion.command} `);
      setSuggestions([]);
      setActiveIndex(0);
      // Move cursor to end on next tick
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
      });
    },
    [setMessage, textareaRef]
  );

  const handleAutocompleteKeyDown = React.useCallback(
    (e) => {
      if (!open) return false;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? Math.max(0, suggestions.length - 1) : i - 1));
        return true;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i >= suggestions.length - 1 ? 0 : i + 1));
        return true;
      }
      if (e.key === "Tab" || (e.key === "Enter" && suggestions.length > 0)) {
        e.preventDefault();
        if (suggestions[activeIndex]) applySelection(suggestions[activeIndex]);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestions([]);
        setArgHint(null);
        return true;
      }
      return false;
    },
    [open, suggestions, activeIndex, applySelection]
  );

  return {
    autocompleteOpen: open,
    suggestionListProps: { suggestions, activeIndex, onSelect: applySelection, argHint },
    handleAutocompleteKeyDown,
  };
}

// ── ChatBubble ────────────────────────────────────────────────────────────────
// Renders one message bubble. The sender attribution row appears below the
// last consecutive message in each player's run (i.e. when nextItem is from
// a different player).
const ChatBubble = React.memo(({ item, nextItem, players, currentPlayerId, gmId, onWhisper }) => {
  const player     = players.find((y) => y.id === item.playerId);
  const isSelf     = player !== undefined && player.id === currentPlayerId;
  const showSender = item.playerId !== nextItem?.playerId;
  // Whisper / GM roll — seen only by the sender, the recipient and the GM.
  const privacy    = describePrivacy(item, { players, meId: currentPlayerId, gmId });

  return (
    <Flex direction="column" gap="4px">
      {privacy && (
        <Text className="nm_chatPrivacy" fontSize="11px" color={themeColors.accentText} fontStyle="italic" mx="10px" mb="-2px">
          {privacy.label}
        </Text>
      )}
      {/* Bubble */}
      <Box
        className={isSelf ? "nm_chatMessage nm_chatMessage_own" : "nm_chatMessage"}
        px="10px"
        py="7px"
        mx="8px"
        borderRadius="6px"
        bg={isSelf ? themeColors.chatOwn : BG_RAISED}
        borderWidth="1px"
        borderStyle={privacy ? "dashed" : "solid"}
        borderColor={privacy ? themeColors.accent : isSelf ? themeColors.chatOwnBorder : BORDER_CLR}
        fontSize="13px"
        color="var(--nordvik-text-color)"
        wordBreak="break-word"
      >
        <ChatMessageContent item={item} />
      </Box>

      {/* Sender label — only on the last message in a consecutive run */}          {showSender && (
            <Flex direction="row" alignItems="center" gap="6px" px="8px" mt="2px" mb="10px">
          {player && <PlayerAvatar size="20px" player={player} />}
          {player && !isSelf && onWhisper ? (
            // Click a name to whisper back.
            <Text
              as="button"
              type="button"
              fontSize="11px"
              color={TEXT_MUTED}
              fontStyle="italic"
              cursor="pointer"
              title={`Whisper to ${player.name}`}
              _hover={{ textDecoration: "underline", color: "var(--nordvik-text-color)" }}
              onClick={() => onWhisper(player.name)}
            >
              {player.name}
            </Text>
          ) : (
            <Text fontSize="11px" color={TEXT_MUTED} fontStyle="italic">
              {player?.name ?? "[Unknown]"}
            </Text>
          )}
        </Flex>
      )}
    </Flex>
  );
});

// ── EmptyChat ─────────────────────────────────────────────────────────────────
const EmptyChat = React.memo(() => (
  <Flex
    flex={1}
    direction="column"
    alignItems="center"
    justifyContent="center"
    gap="8px"
    color={TEXT_MUTED}
    userSelect="none"
    pb="20px"
  >
    <FaPaperPlane size={28} style={{ opacity: 0.3 }} />
    <Text fontSize="13px">No messages yet</Text>
  </Flex>
));

// ── ChatPanel ─────────────────────────────────────────────────────────────────
export const ChatPanel = () => {
  // Click-to-roll dice builder for players who don't know the /r syntax.
  const [diceOpen, setDiceOpen] = React.useState(false);
  const [items,           setItems          ] = React.useState([]);
  const [message,         setMessage        ] = React.useState("");
  const [reachedTop,      setReachedTop     ] = React.useState(false);
  const [loadedPages,     setLoadedPages    ] = React.useState(0);
  const [players,         setPlayers        ] = React.useState([]);
  const [currentPlayerId, setCurrentPlayerId] = React.useState(undefined);
  const [gmId,            setGmId           ] = React.useState(undefined);
  const [filter,          setFilter         ] = React.useState(undefined);
  const [from,            setFrom           ] = React.useState(undefined);
  const [searchOpen,      setSearchOpen     ] = React.useState(false);
  const [loading,         setLoading        ] = React.useState(true);
  const searchActive = !!(filter || from);

  // Stable refs so callbacks never go stale
  const loadedPagesRef = React.useRef(0);
  const filterRef      = React.useRef(undefined);
  const fromRef        = React.useRef(undefined);
  const reachedTopRef  = React.useRef(false);
  const loadingRef     = React.useRef(true);  const cancelledRef   = React.useRef(false);
  const textareaRef    = React.useRef(null);
  const {
    suggestionListProps,
    handleAutocompleteKeyDown,
  } = useCommandAutocomplete(message, setMessage, textareaRef, players, currentPlayerId);

  React.useLayoutEffect(() => { loadedPagesRef.current = loadedPages; }, [loadedPages]);
  React.useLayoutEffect(() => { filterRef.current      = filter;      }, [filter]);
  React.useLayoutEffect(() => { fromRef.current        = from;        }, [from]);
  React.useLayoutEffect(() => { reachedTopRef.current  = reachedTop;  }, [reachedTop]);
  React.useLayoutEffect(() => { loadingRef.current     = loading;     }, [loading]);

  const ctx = Dockable?.useContentContext();
  ctx?.setTitle("Chat");

  // ── Initial load ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    cancelledRef.current = false;

    const run = async () => {
      try {
        const [chatItems, allPlayers, currentPlayer] = await Promise.all([
          WebHelper.getAsync("battlemap/getchat"),
          Promise.resolve(ClientMediator.sendCommand("Game", "GetPlayers", {})),
          Promise.resolve(ClientMediator.sendCommand("Game", "GetCurrentPlayer", {})),
        ]);
        if (cancelledRef.current) return;
        setItems(stampKeys(chatItems));
        setPlayers(allPlayers ?? []);
        setCurrentPlayerId(currentPlayer?.id);
        setGmId(ClientMediator.sendCommand("Game", "GetOwner", {}));
      } catch (err) {
        console.error("[ChatPanel] Load failed:", err);
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    };

    run();

    const uuid = UtilityHelper.GenerateUUID();
    ClientMediator.register({
      panel: "chat",
      id: uuid,
      onEvent: (eventName, { all }) => {
        if (eventName === "PlayersChanged") setPlayers(all ?? []);
      },

      SendMessage: (message) => {
        handleSend(message);
      }
    });

    return () => {
      cancelledRef.current = true;
      ClientMediator.unregister(uuid);
    };
  }, []);

  // ── Reload when search params change (skip while initial load is running) ───
  React.useEffect(() => {
    if (loadingRef.current) return;     // initial load not finished yet
    let cancelled = false;

    const reload = async () => {
      let args = "temporary=true";
      if (filterRef.current) args += `&filter=${encodeURIComponent(filterRef.current)}`;
      if (fromRef.current)   args += `&from=${encodeURIComponent(fromRef.current)}`;
      try {
        const x = await WebHelper.getAsync(`battlemap/getchat?${args}`);
        if (cancelled) return;
        setReachedTop(false);
        setLoadedPages(0);
        setItems(stampKeys(x));
      } catch (err) {
        console.error("[ChatPanel] Reload failed:", err);
      }
    };

    reload();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, from]);

  // ── Reply: "/w Name " in the box, ready to type ────────────────────────────
  const startWhisper = React.useCallback((name) => {
    setMessage(`/w ${name} `);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
    });
  }, []);

  // ── Incoming WS chat message ────────────────────────────────────────────────
  const onChatMessage = React.useCallback((event) => {
    setItems((prev) => [stampKey(event), ...prev]);
  }, []);

  // ── Player settings update (no state mutation) ──────────────────────────────
  const onPlayerSettings = React.useCallback((event) => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === event.data.id
          ? {
              ...p,
              name:  event.data.name  || p.name,
              color: event.data.color || p.color,
              image: event.data.image || p.image,
            }
          : p
      )
    );
  }, []);

  // ── Load older messages on scroll ───────────────────────────────────────────
  const appendChat = React.useCallback(async () => {
    if (reachedTopRef.current) return;
    const nextPage = loadedPagesRef.current + 1;
    let args = `page=${nextPage}`;
    if (filterRef.current) args += `&filter=${encodeURIComponent(filterRef.current)}`;
    if (fromRef.current)   args += `&from=${encodeURIComponent(fromRef.current)}`;
    try {
      const x = await WebHelper.getAsync(`battlemap/getchat?${args}`);
      if (!x || x.length === 0) {
        setReachedTop(true);
      } else {
        setItems((prev) => [...prev, ...stampKeys(x)]);
        setLoadedPages(nextPage);
      }
    } catch (err) {
      console.error("[ChatPanel] AppendChat failed:", err);
    }
  }, []);

  // ── Scroll handler (column-reverse: scrollTop ≤ 0 at oldest-message end) ───
  const onScroll = React.useCallback(
    (e) => {
      const el = e.currentTarget;
      const atEnd = Math.abs(el.scrollTop) + el.clientHeight >= el.scrollHeight - 3;
      if (atEnd && !reachedTopRef.current) appendChat();
    },
    [appendChat]
  );

  // ── Send ─────────────────────────────────────────────────────────────────────
  const handleSend = React.useCallback(async (mediator_message) => {
    const trimmed =
      typeof mediator_message === "string"
        ? mediator_message.trim()
        : message.trim();
    if (!trimmed) return;

    // /c <command> — local command execution
    if (trimmed.startsWith("/c ")) {
      const cmessage = trimmed.slice(3);
      CommandExecutionHelper.LoadSuggestions?.();
      let result;
      try {
        result = await CommandExecutionHelper.RunCommand(cmessage);
      } catch (err) {
        result = `Error: ${err?.message ?? err}`;
      }
      const display =
        result !== undefined && result !== null
          ? typeof result === "object"
            ? JSON.stringify(result, null, 2)
            : String(result)
          : `Executed ${cmessage}`;
      setItems((prev) => [stampKey({ data: display }), ...prev]);
      setMessage("");
      return;
    }

    const command = CommandFactory.CreateChatSendCommand(trimmed);
    WebSocketManagerInstance.Send(command);
    setMessage("");
    textareaRef.current?.focus();
  }, [message]);
  const onKeyDown = React.useCallback(
    (e) => {
      // Let the autocomplete list handle arrow/tab/enter/escape first
      if (handleAutocompleteKeyDown(e)) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, handleAutocompleteKeyDown]
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <Subscribable commandPrefix="settings_player" onMessage={onPlayerSettings} />
      <Subscribable commandPrefix="chat"            onMessage={onChatMessage}    />

      <BasePanel>
        {/* Message list — column-reverse so newest is at the bottom */}
        <Flex
          flex={1}
          direction="column-reverse"
          overflowY="auto"
          overflowX="hidden"
          onScroll={onScroll}
          py="6px"
        >
          {loading ? (
            <Flex flex={1} align="center" justify="center" pb="20px">
              <Text fontSize="13px" color={TEXT_MUTED}>Loading…</Text>
            </Flex>
          ) : items.length === 0 ? (
            <EmptyChat />
          ) : (
            items.map((item, i) => (
              <ChatBubble
                key={item._reactKey ?? i}
                item={item}
                nextItem={items[i + 1]}
                players={players}
                currentPlayerId={currentPlayerId}
                gmId={gmId}
                onWhisper={startWhisper}
              />
            ))
          )}

          {reachedTop && (
            <Flex justifyContent="center" py="6px">
              <Text fontSize="11px" color={TEXT_MUTED}>— Beginning of chat —</Text>
            </Flex>
          )}
        </Flex>

        <Separator borderColor={BORDER_CLR} />        {/* Compose area */}
        <Flex
          direction="row"
          alignItems="flex-end"
          gap="0"
          bg={BG_RAISED}
          p="6px"
          flexShrink={0}
          position="relative"
        >
          {/* Command autocomplete list — floats above the compose row */}
          <CommandSuggestionList {...suggestionListProps} />
          {/* Search — a popover like the dice roller's; the search stays on after it closes */}
          <PopoverRoot
            open={searchOpen}
            onOpenChange={(e) => setSearchOpen(e.open)}
            positioning={{ placement: "top-start" }}
            lazyMount
          >
            <PopoverTrigger asChild>
              <IconButton
                size="sm"
                variant={searchOpen ? "solid" : "ghost"}
                aria-label="Search messages"
                title={searchActive ? "Search messages (filtered)" : "Search messages"}
                alignSelf="flex-end"
                mb="1px"
                mr="4px"
                flexShrink={0}
                position="relative"
                color={searchOpen || searchActive ? "white" : TEXT_MUTED}
              >
                <Icon as={FaSearch} />
                {searchActive && (
                  <Box
                    as="span"
                    data-testid="chat-search-active"
                    position="absolute"
                    top="2px"
                    right="2px"
                    boxSize="8px"
                    borderRadius="full"
                    bg={themeColors.accent}
                  />
                )}
              </IconButton>
            </PopoverTrigger>
            <PopoverContent width="auto" bg={BG_RAISED} borderColor={BORDER_CLR}>
              <PopoverBody p={0}>
                <ChatSearch filter={filter} setFilter={setFilter} from={from} setFrom={setFrom} players={players} />
              </PopoverBody>
            </PopoverContent>
          </PopoverRoot>

          <Textarea
            ref={textareaRef}
            flex={1}
            placeholder="Type a message… (Shift+Enter for new line)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={onKeyDown}
            resize="none"
            minH="38px"
            maxH="120px"
            overflowY="auto"
            size="sm"
            className="nm_chatInput"
            bg={BG_SURFACE}
            borderColor={BORDER_CLR}
            color="var(--nordvik-text-color)"
            _placeholder={{ color: TEXT_MUTED }}
            _focus={{ borderColor: themeColors.inputFocus, boxShadow: "none" }}
            borderRadius="6px"
          />

          <PopoverRoot
            open={diceOpen}
            onOpenChange={(e) => setDiceOpen(e.open)}
            positioning={{ placement: "top-end" }}
            lazyMount
          >
            <PopoverTrigger asChild>
              <IconButton
                size="sm"
                variant={diceOpen ? "solid" : "ghost"}
                aria-label="Roll dice"
                title="Roll dice"
                data-tour="chat-dice"
                alignSelf="flex-end"
                mb="1px"
                ml="4px"
                flexShrink={0}
                color={diceOpen ? "white" : TEXT_MUTED}
              >
                <Icon as={FaDiceD20} />
              </IconButton>
            </PopoverTrigger>
            <PopoverContent width="auto" bg={BG_RAISED} borderColor={BORDER_CLR}>
              <PopoverBody p={0}>
                <DiceRoller onRolled={() => setDiceOpen(false)} />
              </PopoverBody>
            </PopoverContent>
          </PopoverRoot>

          <Tooltip content="Send (Enter)" openDelay={300}>
            <IconButton
              size="sm"
              variant="solid"
              aria-label="Send message"
              onClick={handleSend}
              alignSelf="flex-end"
              mb="1px"
              ml="4px"
              flexShrink={0}
              disabled={!message.trim()}
            >
              <Icon as={FaPaperPlane} />
            </IconButton>
          </Tooltip>
        </Flex>
      </BasePanel>
    </>
  );
};

export default ChatPanel;
