import * as React from "react";
import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import ClientMediator from "../../../ClientMediator";

// Shown in the map's overlay while the player points at a place for an action
// (RequestPoint): what to point at, a note when the marker is out of range, and Cancel
// (or Escape).
export const PickPointOverlay = ({ battleMapId, pointing }) => {
  const [state, setState] = React.useState(pointing.state);
  React.useEffect(() => {
    pointing.listeners.add(setState);
    return () => pointing.listeners.delete(setState);
  }, [pointing]);

  const cancel = React.useCallback(
    () => ClientMediator.sendCommand("BattleMap", "CancelPickPoint", { contextId: battleMapId }),
    [battleMapId]
  );
  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && cancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel]);

  const outOfRange = state.position && !state.allowed;

  return (
    <Stack gap={1} maxW="300px">
      <Text fontSize="sm" fontWeight="semibold">{state.message || "Click a place on the map"}</Text>
      <HStack justify="space-between" gap={3}>
        <Text fontSize="xs" color={outOfRange ? "red.400" : undefined}>
          {outOfRange ? "Out of range" : "Click to choose, Esc to cancel"}
        </Text>
        <Button size="2xs" variant="outline" onClick={cancel}>Cancel</Button>
      </HStack>
    </Stack>
  );
};

export default PickPointOverlay;
