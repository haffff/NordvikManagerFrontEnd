import * as React from "react";
import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import ClientMediator from "../../../ClientMediator";

// Shown in the map's overlay while the player picks tokens for an action (RequestTargets,
// or the action editor's "Run from map"): what to pick, how many are picked, Done / Cancel.
export const PickTargetsOverlay = ({ battleMapId, picking }) => {
  const [state, setState] = React.useState(picking.state);
  React.useEffect(() => {
    picking.listeners.add(setState);
    return () => picking.listeners.delete(setState);
  }, [picking]);

  const send = (command) => ClientMediator.sendCommand("BattleMap", command, { contextId: battleMapId });
  const done = state.picked.length >= state.min;

  return (
    <Stack gap={1} maxW="300px">
      <Text fontSize="sm" fontWeight="semibold">{state.message || "Pick on the map"}</Text>
      <HStack justify="space-between" gap={3}>
        <Text fontSize="xs">
          Picked {state.picked.length}/{state.max}{state.min > 1 ? ` (at least ${state.min})` : ""}
        </Text>
        <HStack gap={1}>
          <Button size="2xs" colorPalette="blue" disabled={!done} onClick={() => send("FinishPickTargets")}>Done</Button>
          <Button size="2xs" variant="outline" onClick={() => send("CancelPickTargets")}>Cancel</Button>
        </HStack>
      </HStack>
    </Stack>
  );
};

export default PickTargetsOverlay;
