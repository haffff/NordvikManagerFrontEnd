import * as React from "react";
import { Box, Button, Flex, HStack, Input, NativeSelect, Text } from "@chakra-ui/react";
import { FaMinus, FaPlus } from "react-icons/fa";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { ActiveTransportManager } from "../../../helpers/transport";
import themeColors from "../../../helpers/themeColors";
import {
  DIE_TYPES,
  emptyDiceState,
  buildDiceFormula,
  describeAvailability,
  describeFormula,
  toChatCommand,
} from "../../../helpers/diceFormula";

// Click-to-roll dice builder for players who don't know the "/r" syntax. It builds the
// same "/r <formula>" chat command a player could type (helpers/diceFormula.js) and sends
// it through chat, so the result shows up as a normal roll card. The formula is shown
// live, so the syntax is learnt along the way. Used in the chat popover and DiceRollerPanel.

const dieLabel = (die) => (die === "F" ? "dF" : `d${die}`);

const SectionLabel = ({ children }) => (
  <Text fontSize="2xs" textTransform="uppercase" letterSpacing="0.06em" color={themeColors.textMuted} mb={1}>
    {children}
  </Text>
);

// A disabled control explains itself: the reason replaces the control's hint text.
const Hint = ({ availability }) =>
  !availability.enabled ? (
    <Text fontSize="2xs" color={themeColors.textMuted} mt={1}>
      {availability.reason}
    </Text>
  ) : null;

const Select = ({ label, value, onChange, disabled, children, width = "auto" }) => (
  <NativeSelect.Root size="xs" width={width} disabled={disabled}>
    <NativeSelect.Field aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {children}
    </NativeSelect.Field>
    <NativeSelect.Indicator />
  </NativeSelect.Root>
);

export const DiceRoller = ({ onRolled }) => {
  const [state, setState] = React.useState(emptyDiceState);
  const [showMore, setShowMore] = React.useState(false);

  const update = (patch) => setState((s) => ({ ...s, ...patch }));
  const changeDie = (die, delta) =>
    setState((s) => ({ ...s, pool: { ...s.pool, [die]: Math.max(0, Math.min(99, s.pool[die] + delta)) } }));

  const formula = buildDiceFormula(state);
  const availability = describeAvailability(state);
  const hasD20 = state.pool[20] > 0;

  const modifier = Math.trunc(Number(state.modifier) || 0);
  const usedDice = DIE_TYPES.filter((die) => state.pool[die] > 0);

  const roll = () => {
    if (!formula) return;
    ActiveTransportManager.Send(CommandFactory.CreateChatSendCommand(toChatCommand(formula)));
    onRolled?.(formula);
  };

  return (
    <Box
      className="nm_diceRoller"
      p={3}
      minW="260px"
      color="var(--nordvik-text-color)"
      // Keep typing in the roller (selects included) away from the game's keyboard bindings.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <SectionLabel>Dice — click to add, right-click to remove</SectionLabel>
      <Flex wrap="wrap" gap={1} mb={3}>
        {DIE_TYPES.map((die) => {
          const count = state.pool[die];
          return (
            <Button
              key={die}
              className="nm_diceRollerDie"
              aria-label={`Add ${dieLabel(die)}`}
              size="sm"
              minW="52px"
              variant={count > 0 ? "solid" : "outline"}
              position="relative"
              onClick={() => changeDie(die, 1)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                changeDie(die, -1);
              }}
            >
              {dieLabel(die)}
              {count > 0 && (
                <Box
                  as="span"
                  position="absolute"
                  top="-6px"
                  right="-6px"
                  minW="18px"
                  px="4px"
                  borderRadius="full"
                  fontSize="2xs"
                  lineHeight="18px"
                  bg={themeColors.accent}
                  color={themeColors.accentText}
                >
                  {count}
                </Box>
              )}
            </Button>
          );
        })}
        <Button size="sm" variant="ghost" onClick={() => setState((s) => ({ ...emptyDiceState(), modifier: s.modifier }))}>
          Clear
        </Button>
      </Flex>

      {usedDice.length > 0 && (
        // Tap-friendly way to remove one die (right-click isn't available on touch screens).
        <Flex wrap="wrap" gap={1} mt={-1} mb={3}>
          {usedDice.map((die) => (
            <Button
              key={die}
              size="2xs"
              variant="subtle"
              aria-label={`Remove ${dieLabel(die)}`}
              onClick={() => changeDie(die, -1)}
            >
              {state.pool[die]}{dieLabel(die)} <FaMinus />
            </Button>
          ))}
        </Flex>
      )}

      <SectionLabel>Modifier</SectionLabel>
      <HStack gap={1} mb={3}>
        <Button size="xs" variant="outline" aria-label="Decrease modifier" onClick={() => update({ modifier: modifier - 1 })}>
          <FaMinus />
        </Button>
        {/* Text, not number: keeps a half-typed "-" instead of snapping it to 0.
            diceFormula reads it with Number(), so anything non-numeric counts as 0. */}
        <Input
          aria-label="Modifier"
          inputMode="numeric"
          size="xs"
          width="64px"
          textAlign="center"
          value={state.modifier}
          onChange={(e) => update({ modifier: e.target.value.replace(/[^0-9-]/g, "") })}
        />
        <Button size="xs" variant="outline" aria-label="Increase modifier" onClick={() => update({ modifier: modifier + 1 })}>
          <FaPlus />
        </Button>
      </HStack>

      {hasD20 && (
        <Box mb={3}>
          <SectionLabel>d20</SectionLabel>
          <HStack gap={1}>
            {[
              ["none", "Normal"],
              ["adv", "Advantage"],
              ["dis", "Disadvantage"],
            ].map(([value, label]) => (
              <Button
                key={value}
                size="xs"
                variant={state.advantage === value ? "solid" : "outline"}
                aria-pressed={state.advantage === value}
                disabled={!availability.advantage.enabled}
                onClick={() => update({ advantage: value })}
              >
                {label}
              </Button>
            ))}
          </HStack>
          <Hint availability={availability.advantage} />
        </Box>
      )}

      <Button size="xs" variant="ghost" mb={showMore ? 2 : 3} onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
        {showMore ? "Fewer options" : "More options"}
      </Button>

      {showMore && (
        <Box mb={3} pl={2} borderLeft="2px solid" borderColor={themeColors.border}>
          <Box mb={2}>
            <SectionLabel>Keep / drop</SectionLabel>
            <HStack gap={1}>
              <Select
                label="Keep or drop"
                value={state.keepDrop?.kind ?? ""}
                disabled={!availability.keepDrop.enabled}
                onChange={(kind) => update({ keepDrop: kind ? { kind, count: state.keepDrop?.count ?? 1 } : null })}
                width="160px"
              >
                <option value="">Keep all</option>
                <option value="kh">Keep highest</option>
                <option value="kl">Keep lowest</option>
                <option value="dh">Drop highest</option>
                <option value="dl">Drop lowest</option>
              </Select>
              {state.keepDrop && availability.keepDrop.enabled && (
                <Input
                  aria-label="Keep/drop count"
                  type="number"
                  size="xs"
                  width="56px"
                  min={1}
                  value={state.keepDrop.count}
                  onChange={(e) => update({ keepDrop: { ...state.keepDrop, count: Math.max(1, Math.trunc(Number(e.target.value) || 1)) } })}
                />
              )}
            </HStack>
            <Hint availability={availability.keepDrop} />
          </Box>

          <Box mb={2}>
            <Button
              size="xs"
              variant={state.exploding ? "solid" : "outline"}
              aria-pressed={state.exploding}
              onClick={() => update({ exploding: !state.exploding })}
            >
              Exploding dice
            </Button>
            <Text fontSize="2xs" color={themeColors.textMuted} mt={1}>
              A die that rolls its highest face is rolled again and added.
            </Text>
          </Box>

          <Box>
            <SectionLabel>Dice pool</SectionLabel>
            <HStack gap={1}>
              <Select
                label="Count"
                value={state.successes?.mode ?? ""}
                disabled={!availability.successes.enabled}
                onChange={(mode) =>
                  update({ successes: mode ? { cmp: ">", target: 5, ...state.successes, mode } : null })
                }
                width="130px"
              >
                <option value="">Add up dice</option>
                <option value="cs">Count successes</option>
                <option value="cf">Count failures</option>
              </Select>
              {state.successes && availability.successes.enabled && (
                <>
                  <Select
                    label="Comparison"
                    value={state.successes.cmp}
                    onChange={(cmp) => update({ successes: { ...state.successes, cmp } })}
                    width="64px"
                  >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value="=">=</option>
                  </Select>
                  <Input
                    aria-label="Target"
                    type="number"
                    size="xs"
                    width="56px"
                    value={state.successes.target}
                    onChange={(e) => update({ successes: { ...state.successes, target: Math.trunc(Number(e.target.value) || 0) } })}
                  />
                </>
              )}
            </HStack>
            <Hint availability={availability.successes} />
          </Box>
        </Box>
      )}

      <Box
        className="nm_diceRollerPreview"
        bg={themeColors.surfaceSunken}
        border="1px solid"
        borderColor={themeColors.border}
        borderRadius="6px"
        px={2}
        py={1}
        mb={2}
      >
        <Text data-testid="dice-formula" fontFamily="mono" fontSize="sm">
          {formula ? toChatCommand(formula) : "/r …"}
        </Text>
        <Text fontSize="2xs" color={themeColors.textMuted}>
          {describeFormula(state)}
          {formula ? " — you can also type this in chat." : ""}
        </Text>
      </Box>

      <Button width="100%" size="sm" colorPalette="green" disabled={!formula} onClick={roll}>
        Roll
      </Button>
    </Box>
  );
};

export default DiceRoller;
