import * as React from "react";
import { Box, Button, Flex, Heading, Icon, Stack, Text } from "@chakra-ui/react";
import { FaFolderOpen } from "@react-icons/all-files/fa/FaFolderOpen";
import { toaster } from "../../ui/toaster";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import UtilityHelper from "../../../helpers/UtilityHelper";
import themeColors from "../../../helpers/themeColors";
import { MaterialChooser } from "../../uiComponents/MaterialChooser";
import { GameStylesheetSettings } from "../theme/StylesheetSettings";
import {
  SYSTEM_ASSET_KEYS,
  SYSTEM_ASSET_DEFAULTS,
  resolveSystemAssetUrl,
  invalidateSystemAsset,
} from "../../../helpers/systemAssets";

// Backend MimeType enum only recognises these description strings
// (NordvikManager.Domain.Enums.MimeType) — anything else silently degrades to
// MimeType.None server-side, so the picker offers only these.
const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const SUPPORTED_AUDIO_MIME_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg"];

const ASSETS = [
  {
    key: SYSTEM_ASSET_KEYS.EMPTY_IMAGE,
    label: "Empty image placeholder",
    description: "Shown wherever an image resource is missing.",
    kind: "image",
    accept: SUPPORTED_IMAGE_MIME_TYPES,
  },
  {
    key: SYSTEM_ASSET_KEYS.EMPTY_TOKEN_IMAGE,
    label: "Empty token image",
    description: "Shown on BattleMap tokens whose card has no image set.",
    kind: "image",
    accept: SUPPORTED_IMAGE_MIME_TYPES,
  },
  {
    key: SYSTEM_ASSET_KEYS.EMPTY_AVATAR_IMAGE,
    label: "Empty player avatar",
    description: "Shown for players who haven't set an avatar.",
    kind: "image",
    accept: SUPPORTED_IMAGE_MIME_TYPES,
  },
  {
    key: SYSTEM_ASSET_KEYS.CHAT_MESSAGE_SOUND,
    label: "Incoming chat message sound",
    description: "Played when a chat message arrives from another player.",
    kind: "audio",
    accept: SUPPORTED_AUDIO_MIME_TYPES,
  },
  {
    key: SYSTEM_ASSET_KEYS.TURN_SOUND,
    label: "Your turn sound",
    description: "Played for a player when the turn order reaches a token they control.",
    kind: "audio",
    accept: SUPPORTED_AUDIO_MIME_TYPES,
  },
];

const dataUrlToBase64 = (dataUrl) => dataUrl.slice(dataUrl.indexOf(",") + 1);

// Create-or-replace by key: CreateResource makes the first one, and 409s if the key
// already exists — UpdateResourceData (by key) replaces it after that.
async function upsertResourceByKey(key, name, blob) {
  const content = dataUrlToBase64(await UtilityHelper.ConvertBlobToB64(blob));

  const created = await WebHelper.postAsync("Materials/CreateResource", {
    Key: key,
    Name: name,
    Content: content,
    MimeType: blob.type,
  });
  if (created.status >= 200 && created.status < 300) return;

  if (created.status === 409) {
    const updated = await WebHelper.putAsync("Materials/ResourceData", { Key: key, Content: content, MimeType: blob.type });
    if (updated.status >= 200 && updated.status < 300) return;
    throw new Error(updated.body?.error ?? `Update failed (HTTP ${updated.status})`);
  }

  throw new Error(created.body?.error ?? `Saving failed (HTTP ${created.status})`);
}

const Preview = ({ kind, src }) => {
  if (!src) return null;
  if (kind === "audio") {
    return <audio controls src={src} style={{ height: "32px", maxWidth: "220px" }} />;
  }
  return (
    <Box boxSize="56px" borderWidth="1px" borderColor={themeColors.divider} borderRadius="6px" overflow="hidden" flexShrink={0} bg={themeColors.background}>
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </Box>
  );
};

// One sound or image: what it is now, and a material picker (filtered to what this slot
// takes; a file dropped on it is uploaded first) to choose another. The chosen material
// is copied under the slot's key, which is what every player's client looks up.
const AssetRow = ({ asset }) => {
  const [previewSrc, setPreviewSrc] = React.useState(null);
  const [picking, setPicking] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const refreshPreview = React.useCallback(() => {
    resolveSystemAssetUrl(asset.key).then(setPreviewSrc);
  }, [asset.key]);

  React.useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  const accepts = React.useCallback((material) => asset.accept.includes(material?.mimeType), [asset.accept]);

  const use = async (materialId) => {
    if (!materialId) return;
    setPicking(false);
    setSaving(true);
    try {
      const blob = await WebHelper.getMaterialAsync(materialId);
      if (!(blob instanceof Blob)) throw new Error("Could not read that material.");
      await upsertResourceByKey(asset.key, asset.label, blob);
      invalidateSystemAsset(asset.key);
      refreshPreview();
      toaster.create({ title: `${asset.label} updated`, type: "success", duration: 3000 });
    } catch (e) {
      toaster.create({ title: `Failed to update ${asset.label}`, description: e?.message, type: "error", duration: 6000 });
    } finally {
      setSaving(false);
    }
  };

  const bundledDefault = SYSTEM_ASSET_DEFAULTS[asset.key];
  const isBundledDefault = bundledDefault !== undefined && previewSrc === bundledDefault;

  return (
    <Box p="10px" borderWidth="1px" borderColor={themeColors.border} borderRadius="6px">
      <Flex align="center" gap="12px">
        <Preview kind={asset.kind} src={previewSrc} />
        <Box flex={1} minW={0}>
          <Text fontSize="sm" fontWeight="medium">{asset.label}</Text>
          <Text fontSize="xs" color="fg.muted">{asset.description}</Text>
          <Text fontSize="xs" color={previewSrc && !isBundledDefault ? "green.400" : "fg.muted"} mt="2px">
            {previewSrc
              ? isBundledDefault ? "Using the bundled default" : "Using this game's own"
              : "Nothing set — choose one to turn it on"}
          </Text>
        </Box>
        <Button
          size="xs"
          variant={picking ? "solid" : "outline"}
          loading={saving}
          aria-label={`Choose ${asset.label}`}
          onClick={() => setPicking((p) => !p)}
        >
          <Icon as={FaFolderOpen} /> Choose…
        </Button>
      </Flex>
      {picking && (
        <Box mt="10px" maxH="280px" overflow="auto">
          <MaterialChooser additionalFilter={accepts} onSelect={use} />
        </Box>
      )}
    </Box>
  );
};

const Section = ({ title, hint, children }) => (
  <Box>
    <Heading size="sm" mb={1}>{title}</Heading>
    {hint && <Text fontSize="xs" color="fg.muted" mb={2}>{hint}</Text>}
    {children}
  </Box>
);

/** Game Settings → Appearance: how the game looks and sounds, for every player. */
export const AppearanceSettings = ({ gameId }) => (
  <Stack gap={5} p={2}>
    {/* Its own title and help link. */}
    <GameStylesheetSettings gameId={gameId} />
    <Section
      title="Sounds & images"
      hint="Leave any of these unset to use the bundled default. Choose one of the game's materials, or drop a file on the list to upload it."
    >
      <Stack gap="10px">
        {ASSETS.map((asset) => (
          <AssetRow key={asset.key} asset={asset} />
        ))}
      </Stack>
    </Section>
  </Stack>
);

export default AppearanceSettings;
