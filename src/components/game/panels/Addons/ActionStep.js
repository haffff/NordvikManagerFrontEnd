import React from "react";
import EditTable from "../../settings/EditTable";
import { Badge, Box, For, HStack, Stack, Text, createListCollection } from "@chakra-ui/react";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValueText } from "../../../ui/select";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { FaArrowAltCircleDown, FaArrowAltCircleUp, FaMinusCircle, FaChevronDown, FaChevronRight } from "react-icons/fa";

const BG_CARD   = "rgb(42,42,42)";
const BG_HEADER = "rgb(52,52,52)";
const BORDER    = "rgb(65,65,65)";

export const ActionStep = ({
  actionId,
  initStep,
  stepDefinitions,
  stepsRef,
  setSteps,
}) => {
  const [step,     setStep]     = React.useState(initStep);
  const [expanded, setExpanded] = React.useState(false);
  const mountedRef              = React.useRef(false);

  const findIdx = (list, id) => list.findIndex((x) => x.id === id);

  const MoveUp = (e) => {
    e.stopPropagation();
    const arr = [...stepsRef.current];
    const idx = findIdx(arr, step.id);
    if (idx > 0) {
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      setSteps(arr);
    }
  };

  const MoveDown = (e) => {
    e.stopPropagation();
    const arr = [...stepsRef.current];
    const idx = findIdx(arr, step.id);
    if (idx !== -1 && idx < arr.length - 1) {
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      setSteps(arr);
    }
  };

  const Delete = (e) => {
    e.stopPropagation();
    const arr = [...stepsRef.current];
    const idx = findIdx(arr, step.id);
    if (idx !== -1) { arr.splice(idx, 1); setSteps(arr); }
  };

  // Sync local edits back to parent — skip mount
  React.useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    const arr = [...stepsRef.current];
    const idx = findIdx(arr, step.id);
    if (idx !== -1) { arr[idx] = step; setSteps(arr); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, setSteps]);

  // Field config — recompute only on type/definitions change
  const stepContent = React.useMemo(() => {
    const base = [
      { key: "Label",   label: "Label",   toolTip: "Label",   type: "string" },
      { key: "Comment", label: "Comment", toolTip: "Comment", type: "string" },
    ];
    const def = stepDefinitions.find((x) => x.value === step.Type);    if (!def?.arguments?.length) return base;
    return [...base, ...def.arguments.map((arg) => ({
      key: arg.name, label: arg.name,
      toolTip: arg.description || arg.name,
      type: arg.type.toLowerCase() === "jtoken" ? "string" : arg.type.toLowerCase(),
    }))];
  }, [step.Type, stepDefinitions]);

  const stepDefinition = stepDefinitions.find((x) => x.value === step.Type);

  const stepDefinitionsCollection = React.useMemo(
    () => createListCollection({ items: stepDefinitions }),
    [stepDefinitions]
  );

  const label   = step?.Data?.Label || "Unnamed step";
  const hasType = Boolean(stepDefinition);

  return (
    <Box
      borderWidth="1px" borderColor={BORDER} borderRadius="md"
      bg={BG_CARD} overflow="hidden"
    >
      {/* ── header row — always visible ── */}
      <HStack
        px={3} py="6px" gap={2} cursor="pointer"
        bg={BG_HEADER}
        _hover={{ bg: "rgb(60,60,60)" }}
        transition="background 0.15s"
        onClick={() => setExpanded((v) => !v)}
        userSelect="none"
      >
        {/* expand chevron */}
        <Box color="gray.500" flexShrink={0} fontSize="10px">
          {expanded ? <FaChevronDown /> : <FaChevronRight />}
        </Box>

        {/* type badge */}
        <Badge
          size="sm" variant="subtle"
          colorPalette={hasType ? "blue" : "gray"}
          flexShrink={0} fontSize="2xs"
          maxWidth="90px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap"
        >
          {step.Type || "No type"}
        </Badge>

        {/* label */}
        <Text fontSize="sm" flex={1} color="gray.200" noOfLines={1}>{label}</Text>

        {/* controls — stop propagation so they don't toggle expand */}
        <HStack gap={0} flexShrink={0} onClick={(e) => e.stopPropagation()}>
          <DListItemButton label="Move up"   icon={FaArrowAltCircleUp}   onClick={MoveUp}   size="xs" />
          <DListItemButton label="Move down" icon={FaArrowAltCircleDown} onClick={MoveDown} size="xs" />
          <DListItemButton label="Delete"    icon={FaMinusCircle}  color="red" onClick={Delete}   size="xs" />
        </HStack>
      </HStack>

      {/* ── expandable body ── */}
      {expanded && (
        <Stack px={3} py={3} gap={3} borderTopWidth="1px" borderColor={BORDER}>
          {/* Type selector */}
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1} textTransform="uppercase" letterSpacing="wider">
              Step type
            </Text>
            <SelectRoot
              collection={stepDefinitionsCollection}
              value={[step.Type]}
              onValueChange={(e) => setStep((prev) => ({ ...prev, Type: e.value[0] }))}
              size="sm"
            >
              <SelectTrigger>
                <SelectValueText placeholder="Select type…">
                  {(items) => items[0]?.name ?? "Select type…"}
                </SelectValueText>
              </SelectTrigger>
              <SelectContent>
                <For each={stepDefinitionsCollection.items}>
                  {(option, index) => (
                    <SelectItem key={index} item={option} value={option.value}
                      selected={step.Type === option.value}>
                      {option.name}
                    </SelectItem>
                  )}
                </For>
              </SelectContent>
            </SelectRoot>
          </Box>

          {/* Step arguments */}
          {stepDefinition && (
            <Box>
              {stepDefinition.description && (
                <Text fontSize="xs" color="gray.500" mb={2} fontStyle="italic">
                  {stepDefinition.description}
                </Text>
              )}
              <EditTable
                keyBase={actionId + step.id + step.Type}
                dto={step.Data}
                editableKeyLabelDict={stepContent}
                hideSaveButton
                saveOnLeave
                onSave={(dto) => setStep((prev) => ({ ...prev, Data: { ...prev.Data, ...dto } }))}
              />
            </Box>
          )}

          {!stepDefinition && step.Type && (
            <Text fontSize="xs" color="orange.400">
              Unknown step type "{step.Type}" — no definition found.
            </Text>
          )}
        </Stack>
      )}
    </Box>
  );
};
