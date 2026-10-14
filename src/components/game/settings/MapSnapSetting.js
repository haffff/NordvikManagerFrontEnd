import * as React from "react";
import { Button, HStack, Heading, Separator, Stack, Text } from "@chakra-ui/react";
import { SNAP_KEYS, SNAP_MODES, setSnapSetting, useSnapSettings } from "../../../helpers/mapSnapSettings";

const MODE_LABELS = { always: "Snap", hold: "Only while holding", never: "Never" };
const OPERATIONS = [
  { operation: "move", label: "Moving" },
  { operation: "scale", label: "Scaling" },
];

// Per-browser, saved as soon as it's picked (like the dock key) — not one of the
// account bindings the shortcuts panel's Save button sends.
export const MapSnapSetting = () => {
  const settings = useSnapSettings();

  return (
    <Stack gap={1}>
      <HStack px={1}>
        <Heading size="sm" color="gray.300">Battle Map Grid Snapping</Heading>
        <Separator flex="1" borderColor="whiteAlpha.200" />
      </HStack>
      {OPERATIONS.map(({ operation, label }) => {
        const current = settings[operation];
        return (
          <HStack key={operation} role="group" aria-label={label} justify="space-between" px={2} py={1} wrap="wrap" gap={2}>
            <Text fontSize="sm">{label}</Text>
            <HStack gap={1} wrap="wrap">
              {SNAP_MODES.map((mode) => (
                <Button
                  key={mode}
                  data-mode={mode}
                  size="xs"
                  variant={current.mode === mode ? "solid" : "outline"}
                  aria-pressed={current.mode === mode}
                  onClick={() => setSnapSetting(operation, { ...current, mode })}
                >
                  {MODE_LABELS[mode]}
                </Button>
              ))}
              <Separator orientation="vertical" height="16px" borderColor="whiteAlpha.300" />
              {SNAP_KEYS.map((key) => (
                <Button
                  key={key}
                  data-key={key}
                  size="xs"
                  variant={current.key === key ? "solid" : "outline"}
                  aria-pressed={current.key === key}
                  disabled={current.mode === "never"}
                  onClick={() => setSnapSetting(operation, { ...current, key })}
                >
                  {key}
                </Button>
              ))}
            </HStack>
          </HStack>
        );
      })}
      <Text fontSize="xs" color="gray.400" px={2}>
        With the grid shown and alignment on. "Snap" snaps unless the key is held; "Only while holding" snaps only while it
        is. Scaling snaps the dragged edges onto grid lines; from a corner it keeps the proportions (one side lands on the
        grid, the other follows). Saved in this browser only.
      </Text>
    </Stack>
  );
};

export default MapSnapSetting;
