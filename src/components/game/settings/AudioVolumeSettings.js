import * as React from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import { AUDIO_CATEGORIES, getVolume, setVolume } from "../../../helpers/audioVolume";

/**
 * How loud music, sound effects and notifications play for you, in this browser.
 * Changes apply straight away, also to what's already playing.
 */
export const AudioVolumeSettings = () => {
  const [volumes, setVolumes] = React.useState(() =>
    Object.fromEntries(AUDIO_CATEGORIES.map(({ key }) => [key, getVolume(key)])));

  const change = (key, percent) => {
    const volume = Number(percent) / 100;
    setVolume(key, volume);
    setVolumes((current) => ({ ...current, [key]: volume }));
  };

  return (
    <Box p={2} className="nm_audioVolumeSettings">
      <Text fontSize="sm" mb={2}>Sound volume (this browser)</Text>
      {AUDIO_CATEGORIES.map(({ key, label, description }) => {
        const percent = Math.round(volumes[key] * 100);
        return (
          <Box key={key} mb={2}>
            <HStack justify="space-between">
              <Text fontSize="xs" title={description}>{label}</Text>
              <Text fontSize="xs" color="fg.muted">{percent === 0 ? "Muted" : `${percent}%`}</Text>
            </HStack>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={percent}
              aria-label={`${label} volume`}
              onChange={(e) => change(key, e.target.value)}
              style={{ width: "100%" }}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default AudioVolumeSettings;
