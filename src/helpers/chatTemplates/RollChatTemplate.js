import * as React from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { ActiveTransportManager as WebSocketManagerInstance } from "../transport";

// ── Design tokens (kept local so the file is self-contained) ──────────────────
const BG_CARD    = "rgb(48,48,48)";
const BG_DIE     = "rgb(38,38,38)";
const BORDER_CLR = "rgb(65,65,65)";
const CLR_CRIT   = "rgb(72,199,116)";   // green
const CLR_FAIL   = "rgb(240,80,80)";    // red
const CLR_NORMAL = "rgb(200,200,200)";  // light-grey
const CLR_MUTED  = "rgb(140,140,140)";

// ── DieChip ───────────────────────────────────────────────────────────────────
const DieChip = ({ result, diceValue, index }) => {
  const isCrit = result === diceValue;
  const isFail = result === 1;
  const color  = isCrit ? CLR_CRIT : isFail ? CLR_FAIL : CLR_NORMAL;

  return (
    <Box
      key={"die_" + index}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      minW="22px"
      h="22px"
      px="4px"
      borderRadius="4px"
      bg={BG_DIE}
      borderWidth="1px"
      borderColor={color}
      fontSize="12px"
      fontWeight="bold"
      color={color}
      title={isCrit ? "Critical!" : isFail ? "Fail" : undefined}
    >
      {result}
    </Box>
  );
};

// ── buildFormulaElements ──────────────────────────────────────────────────────
const buildFormulaElements = (rolled, dices) => {
  // Tokenise into: dice placeholders {N}, numeric literals, and operators.
  // \S+ is intentionally NOT used here — it greedily swallows adjacent tokens
  // (e.g. "+{1}" becomes one token) when there are no spaces in the formula.
  const parts = rolled?.match(/\{\d+\}|[\d.]+|[+\-*/()]/g) ?? [];
  const elements        = [];

  parts.forEach((part, pi) => {
    if (part.startsWith("{") && part.endsWith("}")) {
      const idx     = parseInt(part.slice(1, -1), 10);
      const matched = dices.filter((d) => d.index === idx);

      if (matched.length === 1) {
        elements.push(
          <DieChip key={`p${pi}`} result={matched[0].result} diceValue={matched[0].diceValue} index={idx} />
        );
      } else {
        // Multiple dice for the same placeholder — wrap in parens
        elements.push(
          <Flex key={`p${pi}`} display="inline-flex" alignItems="center" gap="2px">
            <Text fontSize="12px" color={CLR_MUTED}>(</Text>
            {matched.map((d, di) => (
              <React.Fragment key={di}>
                <DieChip result={d.result} diceValue={d.diceValue} index={idx} />
                {di < matched.length - 1 && (
                  <Text fontSize="12px" color={CLR_MUTED}>+</Text>
                )}
              </React.Fragment>
            ))}
            <Text fontSize="12px" color={CLR_MUTED}>)</Text>
          </Flex>
        );
      }
    } else {
      // Operator / literal
      elements.push(
        <Text key={`p${pi}`} fontSize="12px" color={CLR_MUTED} px="1px">{part}</Text>
      );
    }
  });

  return elements;
};

// ── ActionButtons ───────────────────────────────────────────────────────────
// Follow-up buttons attached to a roll (e.g. "Roll Damage" after an attack roll).
// Each carries its own baked-in args, so clicking it doesn't need any of this
// component's own state — it just re-fires the action over the same transport
// a card's Api.FireAction would use.
const ActionButtons = ({ actions }) => {
  const [usedIndices, setUsedIndices] = React.useState(() => new Set());

  if (!actions?.length) return null;

  const fire = (action, index) => {
    WebSocketManagerInstance.Send({
      command: "execute_action",
      data: { Action: action.actionName, Args: action.args ?? {} },
    });
    setUsedIndices((prev) => new Set(prev).add(index));
  };

  return (
    <Flex direction="row" flexWrap="wrap" gap="6px" mt="6px">
      {actions.map((action, index) => (
        <Button
          key={index}
          size="xs"
          disabled={usedIndices.has(index)}
          onClick={() => fire(action, index)}
        >
          {action.label || "Roll"}
        </Button>
      ))}
    </Flex>
  );
};

// ── RollChatTemplate ──────────────────────────────────────────────────────────
export const RollChatTemplate = ({ object }) => {
  if (!object?.roll) return null;

  const { title, roll, message, actions } = object;
  const chatColor       = object.color;
  const chatBorderColor = object.borderColor;
  const { rolled, result, dices } = roll;

  const formulaElements = buildFormulaElements(rolled, dices ?? []);
  return (
    <Box
      borderRadius="6px"
      borderWidth="1px"
      borderColor={chatBorderColor || BORDER_CLR}
      bg={chatColor || BG_CARD}
      px="10px"
      py="8px"
      my="2px"
      maxW="100%"
    >
      {/* Title row */}
      {title && (
        <Text fontSize="11px" color={CLR_MUTED} textTransform="uppercase" letterSpacing="0.05em" mb="4px">
          {title}
        </Text>
      )}

      {/* Formula + dice chips */}
      <Flex direction="row" alignItems="center" flexWrap="wrap" gap="3px" mb="6px">
        {formulaElements}
        <Text fontSize="12px" color={CLR_MUTED} mx="4px">=</Text>
        {/* Total result badge */}
        <Box
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          minW="28px"
          h="26px"
          px="6px"
          borderRadius="5px"
          bg="rgb(38,38,38)"
          borderWidth="1px"
          borderColor="rgb(100,120,180)"
          fontSize="14px"
          fontWeight="bold"
          color="rgb(160,180,240)"
        >
          {result}
        </Box>
      </Flex>

      {/* Optional narrative message */}
      {message && (
        <Text fontSize="12px" color={CLR_MUTED} fontStyle="italic">
          {message}
        </Text>
      )}

      {/* Optional follow-up action buttons (e.g. "Roll Damage") */}
      <ActionButtons actions={actions} />
    </Box>
  );
};
