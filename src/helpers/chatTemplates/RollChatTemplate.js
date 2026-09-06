import * as React from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import ClientMediator from "../../ClientMediator";

// ── Design tokens (kept local so the file is self-contained) ──────────────────
const BG_CARD    = "rgb(48,48,48)";
const BG_DIE     = "rgb(38,38,38)";
const BORDER_CLR = "rgb(65,65,65)";
const CLR_CRIT   = "rgb(72,199,116)";   // green
const CLR_FAIL   = "rgb(240,80,80)";    // red
const CLR_NORMAL = "rgb(200,200,200)";  // light-grey
const CLR_MUTED  = "rgb(140,140,140)";

// ── DieChip ───────────────────────────────────────────────────────────────────
// kept/exploded/success default to the dice engine's "plain NdM roll" defaults
// (true/false/undefined) so old-shaped roll data (no modifiers) renders exactly
// as before.
const DieChip = ({ result, diceValue, index, kept = true, exploded = false, success }) => {
  const isCrit = success === undefined && result === diceValue;
  const isFail = success === undefined && result === 1;
  const color =
    success === true ? CLR_CRIT :
    success === false ? CLR_FAIL :
    isCrit ? CLR_CRIT :
    isFail ? CLR_FAIL :
    CLR_NORMAL;

  const title =
    success === true ? "Success" :
    success === false ? "Failure" :
    isCrit ? "Critical!" :
    isFail ? "Fail" :
    undefined;

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
      borderStyle={exploded ? "dashed" : "solid"}
      borderColor={color}
      fontSize="12px"
      fontWeight="bold"
      color={color}
      opacity={kept ? 1 : 0.4}
      textDecoration={kept ? "none" : "line-through"}
      title={[title, kept ? null : "Dropped", exploded ? "Exploded" : null].filter(Boolean).join(" · ") || undefined}
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
          <DieChip
            key={`p${pi}`}
            result={matched[0].result}
            diceValue={matched[0].diceValue}
            index={idx}
            kept={matched[0].kept}
            exploded={matched[0].exploded}
            success={matched[0].success}
          />
        );
      } else {
        // Multiple dice for the same placeholder — wrap in parens
        elements.push(
          <Flex key={`p${pi}`} display="inline-flex" alignItems="center" gap="2px">
            <Text fontSize="12px" color={CLR_MUTED}>(</Text>
            {matched.map((d, di) => (
              <React.Fragment key={di}>
                <DieChip result={d.result} diceValue={d.diceValue} index={idx} kept={d.kept} exploded={d.exploded} success={d.success} />
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
    ClientMediator.sendCommand("Action", "Run", { name: action.actionName, args: action.args ?? {} });
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
  const { rolled, result, dices, successCount, failureCount } = roll;
  const hasSuccessFail = successCount != null || failureCount != null;

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

      {/* Success/failure counts (only present for cs>N/cf<N rolls) */}
      {hasSuccessFail && (
        <Text fontSize="11px" color={CLR_MUTED} mb="4px">
          {successCount != null && <>{successCount} success{successCount === 1 ? "" : "es"}</>}
          {successCount != null && failureCount != null && "  ·  "}
          {failureCount != null && <>{failureCount} failure{failureCount === 1 ? "" : "s"}</>}
        </Text>
      )}

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
