import * as React from "react";
import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import ClientMediator from "../../../ClientMediator";

// Shown in the map's overlay while an addon map tool (Add Map Tool step) is active.
export const ActionToolOverlay = ({ battleMapId, tool }) => (
  <Stack gap={1} maxW="280px">
    <HStack justify="space-between" gap={3}>
      <Text fontSize="sm" fontWeight="semibold">{tool.uiName || tool.name}</Text>
      <Button
        size="2xs"
        variant="outline"
        onClick={() => ClientMediator.sendCommand("BattleMap", "SetActionToolMode", { contextId: battleMapId, enabled: false })}
      >
        Stop
      </Button>
    </HStack>
    {tool.hint && <Text fontSize="xs" whiteSpace="pre-wrap">{tool.hint}</Text>}
  </Stack>
);

export default ActionToolOverlay;
