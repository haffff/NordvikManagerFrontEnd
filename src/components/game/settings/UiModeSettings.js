import * as React from "react";
import { Box, Button, HStack, NativeSelect, Text } from "@chakra-ui/react";
import { getUiMode, isMobileUi, setUiModeOverride, useUiModeOverride } from "../../../helpers/uiMode";

const LABELS = { auto: "Auto", desktop: "Desktop", mobile: "Mobile" };

/**
 * Desktop (windows you can dock) or mobile (one full-screen panel at a time, with tabs
 * at the bottom) game interface, for this browser. The game keeps the interface it
 * opened with, so a change applies on reload.
 */
export const UiModeSettings = ({ onReload = () => window.location.reload() }) => {
  const override = useUiModeOverride();
  const inUse = isMobileUi() ? "mobile" : "desktop";
  const needsReload = getUiMode() !== inUse;

  return (
    <Box p={2} className="nm_uiModeSettings">
      <Text fontSize="sm" mb={2}>Interface (this browser)</Text>
      <Text fontSize="xs" color="fg.muted" mb={2}>
        Auto uses the mobile interface on phones: one panel at a time, with tabs at the bottom.
      </Text>
      <HStack gap={2}>
        <NativeSelect.Root size="xs" flex={1}>
          <NativeSelect.Field aria-label="Interface" value={override} onChange={(e) => setUiModeOverride(e.target.value)}>
            {Object.entries(LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        {needsReload && <Button size="2xs" variant="outline" onClick={onReload}>Reload to switch</Button>}
      </HStack>
    </Box>
  );
};

export default UiModeSettings;
