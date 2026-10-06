import * as React from "react";
import { Box, Button, HStack, Input, NativeSelect, Text } from "@chakra-ui/react";
import ResourceCache from "../../../helpers/ResourceCache";
import { getCacheLimitMB } from "../../../helpers/cacheSettings";

const MB = 1024 * 1024;
const PRESETS = [0, 250, 500, 1024, 2048];

const formatMB = (mb) => (mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`);
const presetLabel = (mb) => (mb === 0 ? "Off" : formatMB(mb));

/**
 * How much of this browser's storage may keep game files (images, music,
 * stylesheets) between sessions. Per browser, so only shown for your own player.
 */
export const ResourceCacheSettings = () => {
  const [limitMB, setLimitMB] = React.useState(getCacheLimitMB);
  const [usedMB, setUsedMB] = React.useState(null);
  const [availableMB, setAvailableMB] = React.useState(null); // what the browser allows us at most
  const [custom, setCustom] = React.useState(() => !PRESETS.includes(getCacheLimitMB()));
  const [customValue, setCustomValue] = React.useState(() => String(getCacheLimitMB()));

  const refresh = React.useCallback(async () => {
    const used = await ResourceCache.usage();
    setUsedMB(Math.round(used / MB));
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate?.quota) {
        // Space left for this site, plus what the cache already holds.
        setAvailableMB(Math.floor((estimate.quota - (estimate.usage ?? 0) + used) / MB));
      }
    } catch {
      /* not supported — don't limit the choices */
    }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const apply = async (mb) => {
    await ResourceCache.setLimitMB(mb);
    setLimitMB(getCacheLimitMB());
    await refresh();
  };

  const onSelect = (e) => {
    if (e.target.value === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    apply(Number(e.target.value));
  };

  const clear = async () => {
    await ResourceCache.clear();
    await refresh();
  };

  const tooBig = (mb) => availableMB !== null && mb > availableMB;

  return (
    <Box p={2} className="nm_resourceCacheSettings">
      <Text fontSize="sm" mb={2}>Offline cache (this browser)</Text>
      <Text fontSize="xs" color="fg.muted" mb={2}>
        Keeps game files — images, music, stylesheets — so they don't download again next time.
        Changed files are still fetched anew.
      </Text>
      <HStack gap={2}>
        <NativeSelect.Root size="xs" flex={1}>
          <NativeSelect.Field aria-label="Cache size" value={custom ? "custom" : String(limitMB)} onChange={onSelect}>
            {PRESETS.map((mb) => (
              <option key={mb} value={mb} disabled={tooBig(mb)}>{presetLabel(mb)}</option>
            ))}
            <option value="custom">Custom…</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Button size="2xs" variant="outline" onClick={clear}>Clear cache</Button>
      </HStack>
      {custom && (
        <HStack gap={2} mt={2}>
          <Input
            size="xs"
            type="number"
            min={0}
            max={availableMB ?? undefined}
            aria-label="Custom size (MB)"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
          />
          <Text fontSize="xs">MB</Text>
          <Button
            size="2xs"
            variant="outline"
            disabled={!(Number(customValue) >= 0) || tooBig(Number(customValue))}
            onClick={() => apply(Number(customValue))}
          >
            Apply
          </Button>
        </HStack>
      )}
      <Text fontSize="xs" color="fg.muted" mt={2}>
        {limitMB === 0
          ? "Off — nothing is kept between sessions."
          : usedMB === null ? "" : `Using ${usedMB} MB of ${formatMB(limitMB)}`}
      </Text>
      {availableMB !== null && (
        <Text fontSize="xs" color="fg.muted">This browser allows up to about {formatMB(availableMB)}.</Text>
      )}
    </Box>
  );
};

export default ResourceCacheSettings;
