import * as React from "react";
import {
  Badge,
  Box,
  Button,
  For,
  HStack,
  Input,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import CommandExecutionHelper from "../helpers/CommandExecutionHelper";
import DockableHelper from "../helpers/DockableHelper";
import LookupPanel from "./game/panels/Addons/LookupPanel";
import { DialogBackdrop, DialogBody, DialogCloseTrigger, DialogContent, DialogHeader, DialogRoot } from "./ui/dialog";

// TODO - refactor it to make it more readable

// --- helpers ------------------------------------------------------------------
function parseArgContext(inputValue, suggestion, openedBattleMapsCount = 0) {
  if (!suggestion) return { inArgMode: false };
  const commandToken = `${suggestion.panel}.${suggestion.command}`;
  if (!inputValue.startsWith(commandToken)) return { inArgMode: false };
  const rest = inputValue.slice(commandToken.length);
  if (!rest.startsWith(' ')) return { inArgMode: false };
  const argsPart = rest.trimStart();
  const tokens = argsPart.split(' ');
  const currentToken = tokens[tokens.length - 1];

  // Mirror RunCommand: when context is auto-injectable (exactly 1 BM open),
  // the synthetic 'context' arg is invisible to the user — skip it so that
  // positional index 0 maps to the first *real* arg, not the context arg.
  const contextAutoInjectable =
    suggestion.requiresContext && openedBattleMapsCount === 1;
  const args = (suggestion.args ?? []).filter(
    (a) => !(contextAutoInjectable && a.name === 'context' && a.type === 'bmcontext')
  );

  if (currentToken.startsWith('--')) {
    const eqIdx = currentToken.indexOf('=');
    const argName = eqIdx === -1 ? currentToken.slice(2) : currentToken.slice(2, eqIdx);
    const partialValue = eqIdx === -1 ? '' : currentToken.slice(eqIdx + 1);
    const argDef = args.find((a) => a.name === argName) ?? null;
    const prefix = inputValue.slice(0, inputValue.length - partialValue.length);
    return { inArgMode: true, argDef, partialValue, prefix };
  }

  const positionalIndex = tokens.filter((t) => !t.startsWith('--')).length - 1;
  const positionalArgs = args.filter((a) => a.type !== 'object');
  const argDef = positionalArgs[positionalIndex] ?? null;
  const prefix = inputValue.slice(0, inputValue.length - currentToken.length);
  return { inArgMode: true, argDef, partialValue: currentToken, prefix };
}

// --- component ----------------------------------------------------------------
export const QuickCommandDialog = ({ state, openRef, onCloseModal }) => {
  const [open, setOpen] = React.useState(false);
  const [command, setCommand] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const [argCompletions, setArgCompletions] = React.useState([]);
  const [activeArgDef, setActiveArgDef] = React.useState(null);
  const [argPrefix, setArgPrefix] = React.useState("");
  const [activeSuggestion, setActiveSuggestion] = React.useState(null);
  const initialRef = React.useRef();
  const stackRef = React.useRef();
  const argStackRef = React.useRef();
  openRef.current = () => setOpen(true);

  // Resolve open battlemaps once when the dialog opens — used to decide whether
  // to show/hide the synthetic 'context' arg in the info bar.
  const [openedBattleMaps, setOpenedBattleMaps] = React.useState([]);

  // ── Reset all state on every open, reload suggestion index ──────────────────
  React.useEffect(() => {
    if (open) {
      setCommand("");
      setSuggestions([]);
      setArgCompletions([]);
      setActiveArgDef(null);
      setArgPrefix("");
      setActiveSuggestion(null);
      CommandExecutionHelper.LoadSuggestions();
      // Snapshot open battlemaps so the info bar can decide about the context arg
      const maps = CommandExecutionHelper.GetArgCompletions('bmcontext');
      maps.then(setOpenedBattleMaps);
    }
  }, [open]);

  React.useEffect(() => {
    setSuggestions(CommandExecutionHelper.GetSuggestions(command));
  }, [command]);

  React.useEffect(() => {
    const allSuggestions = CommandExecutionHelper._suggestions;
    // Exact token match: "Panel.Command" must be followed by a space (not just a prefix of another command)
    const matched = allSuggestions.find((s) => {
      const token = `${s.panel}.${s.command}`;
      return command === token || command.startsWith(token + ' ');
    });
    setActiveSuggestion(matched ?? null);
    const ctx = parseArgContext(command, matched, openedBattleMaps.length);
    if (!ctx.inArgMode || !ctx.argDef?.type) {
      setArgCompletions([]);
      setActiveArgDef(null);
      setArgPrefix("");
      return;
    }
    setActiveArgDef(ctx.argDef);
    setArgPrefix(ctx.prefix);
    let cancelled = false;
    CommandExecutionHelper.GetArgCompletions(ctx.argDef.type).then((completions) => {
      if (!cancelled) {
        const partial = ctx.partialValue.toLowerCase();
        setArgCompletions(
          partial
            ? completions.filter(
                (c) =>
                  c.value?.toLowerCase().includes(partial) ||
                  c.label?.toLowerCase().includes(partial)
              )
            : completions
        );
      }
    });
    return () => { cancelled = true; };
  }, [command, openedBattleMaps]);

  function applyArgCompletion(completion) {
    // Append a trailing space so the user can immediately type the next arg.
    // The arg-completion effect will clear the list naturally when it re-runs.
    setCommand(argPrefix + completion.value + ' ');
    initialRef.current?.focus();
  }

  function RunCommand() {
    const ran = command;
    setOpen(false);
    CommandExecutionHelper.RunCommand(ran).then((result) => {
      if (result !== undefined) {
        DockableHelper.NewFloating(
          state,
          <LookupPanel name={`${ran} result`} content={result} />
        );
      }
    });
  }

  function focusFirst(ref) { ref?.current?.firstChild?.focus(); }
  return (
    <DialogRoot
      blockScrollOnMount={false}
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      initialFocusRef={initialRef}
      size={"xl"}
    >
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>Run command</DialogHeader>
        <DialogCloseTrigger />
        <DialogBody marginBottom={"20px"}>
          <HStack>
            <Input
              ref={initialRef}
              placeholder="Command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (argCompletions.length > 0) focusFirst(argStackRef);
                  else focusFirst(stackRef);
                }
                if (e.key === "Enter") { RunCommand(); }
              }}
            />
            <Button variant={"outline"} mr={3} onClick={() => { RunCommand(); }}>
              Run
            </Button>
          </HStack>
          <Separator margin={"10px"} />

          {/* ── Command info bar: shown once a full command is matched ──────── */}
          {activeSuggestion && (
            <Box
              px={3} py={2} mb={2}
              borderRadius="md"
              borderWidth="1px"
              borderColor="border.subtle"
              bg="bg.subtle"
            >
              {/* Command title */}
              <HStack gap={1} mb={activeSuggestion.description || activeSuggestion.args?.length > 0 ? 1 : 0}>
                <Text fontSize="sm" color="fg.muted">{activeSuggestion.panel}.</Text>
                <Text fontSize="sm" fontWeight="bold">{activeSuggestion.command}</Text>
                {activeSuggestion.requiresContext && (
                  <Badge size="sm" colorPalette="orange" variant="subtle">BM context</Badge>
                )}
              </HStack>

              {/* Description */}
              {activeSuggestion.description && (
                <Text fontSize="xs" color="fg.muted" mb={activeSuggestion.args?.length > 0 ? 2 : 0}>
                  {activeSuggestion.description}
                </Text>
              )}

              {/* Arg list — highlight the one currently being filled.
                  Hide the synthetic 'context' arg when it will be auto-injected. */}
              {activeSuggestion.args?.length > 0 && (
                <HStack gap={1} flexWrap="wrap">
                  {activeSuggestion.args
                    .filter((arg) => {
                      // If context is auto-injectable (≤1 BM open), hide it from the bar
                      if (arg.name === 'context' && arg.type === 'bmcontext') {
                        return openedBattleMaps.length !== 1;
                      }
                      return true;
                    })
                    .map((arg) => {
                    const isActive = activeArgDef?.name === arg.name;
                    return (
                      <Badge
                        key={arg.name}
                        size="sm"
                        variant={isActive ? "solid" : "outline"}
                        colorPalette={isActive ? "blue" : arg.required ? "blue" : "gray"}
                      >
                        {arg.required ? "" : "?"}{arg.name}
                        {arg.type && arg.type !== "string" ? `: ${arg.type}` : ""}
                      </Badge>
                    );
                  })}
                </HStack>
              )}
            </Box>
          )}
          {argCompletions.length > 0 && (
            <>
              <HStack gap={1} mb={1} px={1}>
                <Text fontSize="xs" color="fg.muted">Values for</Text>
                <Badge size="sm" colorPalette="blue" variant="subtle">{activeArgDef?.name}</Badge>
                <Badge size="sm" colorPalette="purple" variant="outline">{activeArgDef?.type}</Badge>
              </HStack>
              <Stack ref={argStackRef} mb={3}>
                <For each={argCompletions}>
                  {(completion) => (
                    <Box
                      as="button"
                      key={completion.value}
                      paddingX={"10px"}
                      paddingY={"5px"}
                      borderRadius={"md"}
                      textAlign="left"
                      _hover={{ bg: "bg.subtle" }}
                      _focus={{ bg: "bg.subtle", outline: "none" }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          if (e.target.nextSibling) e.target.nextSibling.focus();
                          else focusFirst(argStackRef);
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          if (e.target.previousSibling) e.target.previousSibling.focus();
                          else initialRef.current?.focus();
                        }
                        if (e.key === "Enter") applyArgCompletion(completion);
                        if (e.key === "Escape") initialRef.current?.focus();
                      }}
                      onClick={() => applyArgCompletion(completion)}
                    >
                      <HStack gap={2}>
                        <Text fontSize="sm" fontWeight="bold">{completion.label}</Text>
                        {completion.label !== completion.value && (
                          <Text fontSize="xs" color="fg.muted">{completion.value}</Text>
                        )}
                      </HStack>
                    </Box>
                  )}
                </For>
              </Stack>
              <Separator mb={2} />
            </>
          )}
          <Stack ref={stackRef}>
            <For each={suggestions} fallback={<Text color="fg.muted" fontSize="sm">No suggestions</Text>}>
              {(suggestion) => (
                <Box
                  as="button"
                  paddingX={"10px"}
                  paddingY={"7px"}
                  borderRadius={"md"}
                  textAlign="left"
                  _hover={{ bg: "bg.subtle" }}
                  _focus={{ bg: "bg.subtle", outline: "none" }}
                  key={suggestion.panel + "." + suggestion.command}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      if (e.target.nextSibling) e.target.nextSibling.focus();
                      else focusFirst(stackRef);
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (e.target.previousSibling) e.target.previousSibling.focus();
                      else initialRef.current?.focus();
                    }
                    if (e.key === "Enter") {
                      setCommand(suggestion.panel + "." + suggestion.command + " ");
                      initialRef.current?.focus();
                    }
                    if (e.key === "Escape") initialRef.current?.focus();
                  }}
                  onClick={() => {
                    setCommand(suggestion.panel + "." + suggestion.command + " ");
                    initialRef.current?.focus();
                  }}
                >
                  <HStack gap={2} flexWrap="wrap">
                    <HStack gap={0}>
                      <Text fontSize="sm" color="fg.muted">{suggestion.panel}.</Text>
                      <Text fontSize="sm" fontWeight="bold">{suggestion.command}</Text>
                    </HStack>
                    {suggestion.requiresContext && (
                      <Badge size="sm" colorPalette="orange" variant="subtle">BM context</Badge>
                    )}
                  </HStack>
                  {suggestion.description ? (
                    <Text fontSize="xs" color="fg.muted" mt="1">{suggestion.description}</Text>
                  ) : null}
                  {suggestion.args?.length > 0 && (
                    <HStack gap={1} mt="1" flexWrap="wrap">
                      {suggestion.args.map((arg) => (
                        <Badge
                          key={arg.name}
                          size="sm"
                          variant="outline"
                          colorPalette={arg.required ? "blue" : "gray"}
                        >
                          {arg.required ? "" : "?"}{arg.name}
                          {arg.type && arg.type !== "string" ? `: ${arg.type}` : ""}
                        </Badge>
                      ))}
                    </HStack>
                  )}
                </Box>
              )}
            </For>
          </Stack>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};
export default QuickCommandDialog;
