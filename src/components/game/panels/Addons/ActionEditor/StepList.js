import * as React from "react";
import { Badge, Box, Flex, HStack, IconButton, Spinner, Text } from "@chakra-ui/react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FaCopy } from "@react-icons/all-files/fa/FaCopy";
import { FaGripVertical } from "@react-icons/all-files/fa/FaGripVertical";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaCheck } from "@react-icons/all-files/fa/FaCheck";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { FaStop } from "@react-icons/all-files/fa/FaStop";
import { FaExternalLinkAlt } from "@react-icons/all-files/fa/FaExternalLinkAlt";
import { Tooltip } from "../../../../ui/tooltip";
import { summarizeStep, shortValue, humanizeArgName } from "./stepSummary";
import { T, categoryColor } from "./editorTheme";

// The step list: one compact row per step that reads as a sentence. Drag the grip to
// reorder; hover for duplicate/delete; "+" between rows inserts a step there.
// Arguments that name another action (ExecuteAction, a roll's follow-up) are shown under
// the row with a link that opens that action. Blocks (If's Then / Else, ForEach's Do) are
// shown under their step as lists of their own.

const Summary = ({ segments }) => (
  <Text as="span" fontSize="sm" color={T.text} truncate>
    {segments.map((s, i) => {
      if (s.kind === "token") return <Text as="span" key={i} color={T.token} fontFamily="mono" fontSize="xs">{s.text}</Text>;
      if (s.kind === "missing") return <Text as="span" key={i} color={T.missing} fontStyle="italic">{humanizeArgName(s.text)}?</Text>;
      if (s.kind === "value") return <Text as="span" key={i} color="white">{s.text}</Text>;
      return <Text as="span" key={i} color={T.muted}>{s.text}</Text>;
    })}
  </Text>
);

const TraceMark = ({ trace }) => {
  if (!trace) return null;
  if (trace.status === "running") return <Spinner size="xs" color="blue.300" />;
  if (trace.status === "done") return <FaCheck color="#68D391" size={11} />;
  if (trace.status === "exited") return <Tooltip content="Stopped by Exit"><span><FaStop color="#A0AEC0" size={10} /></span></Tooltip>;
  if (trace.status === "failed")
    return <Tooltip content={trace.error ?? "Failed"}><span><FaTimes color="#FC8181" size={12} /></span></Tooltip>;
  return null;
};

const Inserter = ({ onClick, always }) => (
  <Flex
    h={always ? "28px" : "8px"} align="center" justify="center" cursor="pointer" role="group"
    onClick={onClick} opacity={always ? 1 : 0} _hover={{ opacity: 1, h: "22px" }} transition="all 0.1s"
  >
    <HStack gap={1} color={T.accent} fontSize="xs">
      <FaPlus size={9} /> <Text>{always ? "Add step" : "Insert step here"}</Text>
    </HStack>
  </Flex>
);

const Row = ({ step, index, def, selected, trace, onSelect, onDuplicate, onDelete, onOpenAction, listProps }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const summary = summarizeStep(step, def);
  const comment = step.Data?.Comment;
  const label = step.Data?.Label;
  const blocks = (def?.arguments ?? []).filter((a) => (a.type ?? "").toLowerCase() === "steps");
  const branches = (def?.arguments ?? [])
    .filter((a) => (a.type ?? "").toLowerCase() === "action" && step.Data?.[a.name])
    .map((a) => ({ name: a.name, target: String(step.Data[a.name]) }));

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      opacity={isDragging ? 0.5 : 1}
      bg={selected ? T.selected : T.raised}
      borderWidth="1px" borderColor={selected ? T.selected : T.border} borderRadius="md"
      // className "group": Chakra 3's _groupHover (the Duplicate/Delete buttons below) needs it;
      // role="group" was Chakra 2's, and alone it left those buttons invisible.
      className="group" role="group" onClick={(e) => { e.stopPropagation(); onSelect(step.id); }} cursor="pointer"
      _hover={{ borderColor: selected ? T.selected : "gray.500" }}
    >
      <HStack px={2} py="5px" gap={2} minH="32px">
        <Box {...attributes} {...listeners} color={T.faint} cursor="grab" onClick={(e) => e.stopPropagation()} aria-label="Drag to reorder">
          <FaGripVertical size={11} />
        </Box>
        <Text fontSize="xs" color={T.faint} w="18px" textAlign="right" flexShrink={0}>{index + 1}</Text>
        <Badge size="sm" variant="subtle" colorPalette={def ? categoryColor(def.category) : "red"} flexShrink={0} minW="64px" justifyContent="center">
          {def?.name ?? step.Type ?? "?"}
        </Badge>
        <Box flex={1} minW={0} display="flex" flexDirection="column">
          {label && label !== "New Step" && <Text fontSize="2xs" color={T.muted} truncate>{label}</Text>}
          <Summary segments={def ? summary.segments.slice(0) : [{ kind: "missing", text: `Unknown step type ${step.Type}` }]} />
        </Box>
        <TraceMark trace={trace} />
        <HStack gap={0} opacity={0} _groupHover={{ opacity: 1 }} flexShrink={0} onClick={(e) => e.stopPropagation()}>
          <IconButton size="2xs" variant="ghost" aria-label="Duplicate step" onClick={() => onDuplicate(step.id)}><FaCopy /></IconButton>
          <IconButton size="2xs" variant="ghost" colorPalette="red" aria-label="Delete step" onClick={() => onDelete(step.id)}><FaTrash /></IconButton>
        </HStack>
      </HStack>
      {branches.length > 0 && (
        <Box pl="64px" pb="5px" pr={2}>
          {branches.map((b, i) => (
            <HStack key={b.name} gap={2} fontSize="xs" color={T.muted}>
              <Text fontFamily="mono">{i === branches.length - 1 ? "└" : "├"}</Text>
              <Text>{humanizeArgName(b.name)}</Text>
              <Text color="white" fontFamily="mono" truncate>{shortValue(b.target)}</Text>
              {!b.target.includes("%") && (
                <IconButton size="2xs" variant="ghost" aria-label={`Open ${b.target}`} color={T.accent}
                  onClick={(e) => { e.stopPropagation(); onOpenAction(b.target); }}>
                  <FaExternalLinkAlt />
                </IconButton>
              )}
            </HStack>
          ))}
        </Box>
      )}
      {blocks.map((b) => (
        <Box key={b.name} data-testid={`block-${step.id}-${b.name}`} ml="34px" mr={2} mb="6px" pl={2}
          borderLeftWidth="2px" borderColor={T.border} cursor="default" onClick={(e) => e.stopPropagation()}>
          <Text fontSize="2xs" color={T.muted} textTransform="uppercase" letterSpacing="wide">{humanizeArgName(b.name)}</Text>
          <StepList {...listProps} steps={step.Data?.[b.name] ?? []} container={{ parentId: step.id, block: b.name }} />
        </Box>
      ))}
      {comment && <Text px={2} pb="4px" pl="64px" fontSize="2xs" color={T.faint} fontStyle="italic" truncate>{comment}</Text>}
      {trace?.status === "failed" && trace.error && (
        <Text px={2} pb="4px" pl="64px" fontSize="2xs" color="red.300" truncate>{trace.error}</Text>
      )}
    </Box>
  );
};

// container: where this list sits — null for the action's own steps, { parentId, block }
// for a block of a step. onInsert gets (container, index).
export const StepList = (props) => {
  const {
    steps, defsByType, selectedId, traceFor, container = null,
    onSelect, onMove, onInsert, onDuplicate, onDelete, onOpenAction,
  } = props;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) onMove(active.id, over.id);
  };

  return (
    <Box>
      {steps.length === 0 && !container && (
        <Text fontSize="sm" color={T.faint} fontStyle="italic" py={3} textAlign="center">
          No steps yet.
        </Text>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {steps.map((step, i) => (
            <React.Fragment key={step.id}>
              <Inserter onClick={() => onInsert(container, i)} />
              <Row
                step={step} index={i} def={defsByType[step.Type]}
                selected={step.id === selectedId} trace={traceFor?.(step, i)}
                onSelect={onSelect} onDuplicate={onDuplicate} onDelete={onDelete} onOpenAction={onOpenAction}
                listProps={props}
              />
            </React.Fragment>
          ))}
        </SortableContext>
      </DndContext>
      <Inserter always onClick={() => onInsert(container, steps.length)} />
    </Box>
  );
};

export default StepList;
