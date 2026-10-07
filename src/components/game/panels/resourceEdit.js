// The "Edit Resource" dialog of the resources panel. Audio files also get the GM's
// volume for them (shown 0–100%, stored 0..1), which plays on top of the playlist's
// or soundboard's volume.

export const resourceEditFields = (isAudio) => [
  { key: "name", label: "Resource Name", toolTip: "Name of Resource.", type: "string", required: true },
  { key: "key", label: "Key", toolTip: "Optional short identifier for looking this resource up directly from actions/queries (e.g. \"Apple\") instead of by its ID. Must be unique within this game — leave blank to clear it.", type: "string" },
  ...(isAudio
    ? [{ key: "volume", label: "Volume (%)", toolTip: "How loud this file plays, before the playlist's or soundboard's volume and each player's own.", type: "number", min: 0, max: 100 }]
    : []),
];

export const resourceEditDto = (item) => {
  const dto = { id: item.id, name: item.name, key: item.key };
  if (!item.mimeType?.startsWith("audio")) return dto;
  return { ...dto, volume: Math.round((item.volume ?? 1) * 100), isAudio: true };
};

export const resourceUpdateData = ({ id, name, key, volume, isAudio }) => {
  const data = { id, name, key };
  const percent = Number(volume);
  if (isAudio && Number.isFinite(percent)) data.volume = Math.min(100, Math.max(0, percent)) / 100;
  return data;
};
