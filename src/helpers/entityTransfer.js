import { ActiveWebHelper as WebHelper } from "./transport";

// Export JSON / Import JSON / Duplicate for maps, cards (templates, custom views) and
// playlists (soundboards), through the backend's Transfer endpoints. A duplicate is an
// export imported straight back, next to the original.

export const TRANSFER_KINDS = Object.freeze({
  MAP: "map",
  CARD: "card",
  TEMPLATE: "template",
  VIEW: "view",
  PLAYLIST: "playlist",
  SOUNDBOARD: "soundboard",
});

const FORMAT = "nordvik-entity";
const NOT_AN_EXPORT = "This isn't an exported map, card or playlist.";

export async function exportEntity(kind, id, { includeFiles = false } = {}) {
  const exported = await WebHelper.getAsync(`transfer/Export?kind=${kind}&id=${id}&includeFiles=${includeFiles}`);
  if (!exported) throw new Error("Couldn't export it.");
  return exported;
}

/** Imports into `parentId` (a folder, null for the top level) or right after the entry `afterId`. */
export async function importEntity(exported, { kind, name = null, parentId = null, afterId = null } = {}) {
  const response = await WebHelper.postAsync("transfer/Import", {
    export: exported, kind, name, treeParentId: parentId, afterTreeEntryId: afterId,
  });
  if (response?.status >= 200 && response.status < 300)
    return { id: response.body?.id, missing: response.body?.missing ?? [] };
  throw new Error(response?.body?.error ?? "Couldn't import it.");
}

/** A copy of the entity, named "… (copy)", right after its tree entry. */
export async function duplicateEntity(kind, id, entry) {
  const exported = await exportEntity(kind, id);
  return importEntity(exported, { kind, name: `${exported.name ?? ""} (copy)`, afterId: entry?.id ?? null });
}

export function parseExport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(NOT_AN_EXPORT);
  }
  if (parsed?.format !== FORMAT || !parsed.data) throw new Error(NOT_AN_EXPORT);
  return parsed;
}

export const exportFileName = (exported) =>
  `${(exported.name || exported.kind).replace(/[\\/:*?"<>|]+/g, "_")}.${exported.kind}.json`;

export function downloadJson(fileName, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
