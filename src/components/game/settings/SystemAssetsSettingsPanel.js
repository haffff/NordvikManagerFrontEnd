import * as React from "react";
import { Box, Button, Flex, Icon, Stack, Text } from "@chakra-ui/react";
import { FaUpload, FaUndo } from "react-icons/fa";
import { toaster } from "../../ui/toaster";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import UtilityHelper from "../../../helpers/UtilityHelper";
import {
  SYSTEM_ASSET_KEYS,
  SYSTEM_ASSET_DEFAULTS,
  resolveSystemAssetUrl,
  invalidateSystemAsset,
} from "../../../helpers/systemAssets";

// Backend MimeType enum only recognises these description strings
// (DndOnePlaceManager.Domain.Enums.MimeType) — anything else silently degrades to
// MimeType.None server-side, so filter the file picker and validate before upload.
const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const SUPPORTED_AUDIO_MIME_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg"];

const ROWS = [
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
];

const dataUrlToBase64 = (dataUrl) => dataUrl.slice(dataUrl.indexOf(",") + 1);

// Create-or-replace by key: CreateResource makes the first upload, and 409s if the
// key already exists — UpdateResourceData (by key) handles replacing it after that.
async function upsertResourceByKey(key, name, file) {
  const dataUrl = await UtilityHelper.ConvertBlobToB64(file);
  const content = dataUrlToBase64(dataUrl);

  const created = await WebHelper.postAsync("Materials/CreateResource", {
    Key: key,
    Name: name,
    Content: content,
    MimeType: file.type,
  });

  if (created.status >= 200 && created.status < 300) return;

  if (created.status === 409) {
    const updated = await WebHelper.putAsync("Materials/ResourceData", {
      Key: key,
      Content: content,
      MimeType: file.type,
    });
    if (updated.status >= 200 && updated.status < 300) return;
    throw new Error(updated.body?.error ?? `Update failed (HTTP ${updated.status})`);
  }

  throw new Error(created.body?.error ?? `Upload failed (HTTP ${created.status})`);
}

const Preview = ({ kind, src }) => {
  if (!src) return null;
  if (kind === "audio") {
    return <audio controls src={src} style={{ height: "32px", maxWidth: "220px" }} />;
  }
  return (
    <Box
      boxSize="56px"
      borderWidth="1px"
      borderColor="rgb(70,70,70)"
      borderRadius="6px"
      overflow="hidden"
      flexShrink={0}
      bg="rgb(30,30,30)"
    >
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </Box>
  );
};

const AssetRow = ({ row }) => {
  const [previewSrc, setPreviewSrc] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef(null);

  const refreshPreview = React.useCallback(() => {
    resolveSystemAssetUrl(row.key).then(setPreviewSrc);
  }, [row.key]);

  React.useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  const handleFile = async (file) => {
    if (!file) return;
    if (!row.accept.includes(file.type)) {
      toaster.create({
        title: "Unsupported file type",
        description: `${row.label} accepts: ${row.accept.join(", ")}`,
        type: "error",
        duration: 6000,
      });
      return;
    }

    setUploading(true);
    try {
      await upsertResourceByKey(row.key, row.label, file);
      invalidateSystemAsset(row.key);
      refreshPreview();
      toaster.create({ title: `${row.label} updated`, type: "success", duration: 3000 });
    } catch (e) {
      toaster.create({
        title: `Failed to update ${row.label}`,
        description: e?.message,
        type: "error",
        duration: 6000,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const bundledDefault = SYSTEM_ASSET_DEFAULTS[row.key];
  const isBundledDefault = bundledDefault !== undefined && previewSrc === bundledDefault;

  return (
    <Flex
      align="center"
      gap="12px"
      p="10px"
      borderWidth="1px"
      borderColor="rgb(65,65,65)"
      borderRadius="6px"
    >
      <Preview kind={row.kind} src={previewSrc} />

      <Box flex={1} minW={0}>
        <Text fontSize="sm" fontWeight="medium">{row.label}</Text>
        <Text fontSize="xs" color="gray.500">{row.description}</Text>
        <Text fontSize="xs" color={previewSrc && !isBundledDefault ? "green.400" : "gray.500"} mt="2px">
          {previewSrc
            ? isBundledDefault
              ? "Using bundled default"
              : "Using custom upload"
            : "No default available — upload one to enable"}
        </Text>
      </Box>

      <input
        ref={inputRef}
        type="file"
        accept={row.accept.join(",")}
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        size="xs"
        variant="outline"
        loading={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Icon as={FaUpload} /> Upload
      </Button>
    </Flex>
  );
};

// GM-only per-game overrides for the small set of well-known "system" assets
// (see src/helpers/systemAssets.js) — placeholder images and the chat notification
// sound. Uploading stores a Resource keyed by that well-known key (Materials/
// CreateResource + Materials/ResourceData), same mechanism the rest of the Resource
// system already uses for named keys like "emptyImage".
export const SystemAssetsSettingsPanel = () => (
  <Stack gap="10px" p="4px">
    <Text fontSize="xs" color="gray.500">
      Leave any of these unset to use the bundled default. Uploading replaces the
      default for every player in this game.
    </Text>
    {ROWS.map((row) => (
      <AssetRow key={row.key} row={row} />
    ))}
  </Stack>
);

export default SystemAssetsSettingsPanel;
