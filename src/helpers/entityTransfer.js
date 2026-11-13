import { ActiveWebHelper as WebHelper } from "./transport";
import ProgressToastManager from "./ProgressToastManager";
import UtilityHelper from "./UtilityHelper";

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

/** includeCards (a map): its tokens' cards come along, for another game. */
export async function exportEntity(kind, id, { includeFiles = false, includeCards = false } = {}) {
  const exported = await WebHelper.getAsync(`transfer/Export?kind=${kind}&id=${id}&includeFiles=${includeFiles}${includeCards ? "&includeCards=true" : ""}`);
  if (!exported) throw new Error("Couldn't export it.");
  return exported;
}

const fileNameFor = (exported, kind) =>
  exportFileName({ kind: exported?.kind ?? kind ?? "export", name: exported?.name });

/**
 * Imports an export (the file's text, or the parsed file) into `parentId` (a folder, null
 * for the top level) or right after the entry `afterId`. The file goes up in parts first
 * and waits on the server; a file from another server that brings card code is imported
 * only if confirmCode(inspection) says yes (a card's page runs with the rights of whoever
 * opens it), otherwise it's dropped and this resolves to null. Text is sent as it is: the
 * server checks its signature over it.
 */
// parsed: the export already read from the text (a big one is slow to parse again).
export async function importEntity(exported, options = {}) {
  // A progress toast, as for a Materials upload: waiting its turn behind other uploads,
  // the bytes sent, then the server setting it up. Success says what it made; a failure
  // or a decline closes it (the caller says why).
  const opId = UtilityHelper.GenerateUUID();
  const known = options.parsed ?? (typeof exported === "string" ? null : exported);
  ProgressToastManager.start(opId, { title: `Importing "${options.name ?? known?.name ?? options.kind ?? "it"}"…`, description: "Waiting to send…", total: 1 });
  let parsed = options.parsed ?? exported;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { parsed = null; }
  }
  const label = options.name ?? parsed?.name ?? options.kind ?? "it";
  const step = (current, message) => ProgressToastManager.update(opId, { current, total: 1, message });
  let result;
  try {
    result = await runImport(exported, parsed, options, step);
  } catch (e) {
    ProgressToastManager.dismiss(opId);
    throw e;
  }
  if (!result) {
    ProgressToastManager.dismiss(opId);
    return result;
  }
  const missing = result.missing ?? [];
  ProgressToastManager.complete(opId, {
    title: `Imported "${label}"`,
    description: missing.length ? `Not in this game, left out: ${missing.join(", ")}` : undefined,
    type: missing.length ? "warning" : "success",
    duration: missing.length ? 10000 : 4000,
  });
  return result;
}

async function runImport(exported, parsed, { kind, name = null, parentId = null, afterId = null, confirmCode = async () => false }, step) {
  const text = typeof exported === "string" ? exported : JSON.stringify(exported);
  let lastPercent = -1;
  const upload = await WebHelper.uploadInPieces(
    new Blob([text], { type: "application/json" }),
    { name: fileNameFor(parsed, kind), mimeType: "application/json", forImport: true },
    {
      onProgress: (fraction) => {
        const percent = Math.floor(fraction * 100);
        if (percent === lastPercent) return;
        lastPercent = percent;
        step(Math.min(fraction, 1) * 0.9, `Sending — ${percent}%`);
      },
    },
  );
  if (upload === null) throw new Error("This server can't take imports this way yet: update it.");
  const uploadId = upload?.body?.uploadId;
  if (upload?.status !== 200 || !uploadId) throw new Error(upload?.body?.error ?? "Couldn't send the file.");

  step(0.95, "Sent; setting it up in the game…");
  const request = { uploadId, kind, name, treeParentId: parentId, afterTreeEntryId: afterId };
  let response = await WebHelper.postAsync("transfer/Import", request);
  if (response?.status === 409 && response.body?.inspection) {
    step(0.95, "Waiting for you to allow its card code…");
    if (!(await confirmCode(response.body.inspection))) {
      await WebHelper.postAsync("transfer/CancelImport", { uploadId });
      return null;
    }
    step(0.95, "Sent; setting it up in the game…");
    response = await WebHelper.postAsync("transfer/Import", { ...request, acceptCode: true });
  }
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
