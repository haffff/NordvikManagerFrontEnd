import ClientMediator from "../ClientMediator";
import { importEntity, parseExport } from "./entityTransfer";

// Files dropped onto the battle map or into Materials: an Export JSON file among them is
// offered for import (ask(exported, file) answers "import", "material" or "cancel");
// everything else, and an export the GM wants as a plain file, is uploaded as before.

const MAX_EXPORT_SIZE = 256 * 1024 * 1024;

// File.text() where there is one (browsers), FileReader otherwise.
export const readText = (file) => typeof file.text === "function"
  ? file.text()
  : new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

/** The export in `file` and its text, or null if it isn't one. */
async function readExportFile(file) {
  if (!file || file.size > MAX_EXPORT_SIZE) return null;
  if (!/\.json$/i.test(file.name ?? "") && file.type !== "application/json") return null;
  try {
    const text = await readText(file);
    return { exported: parseExport(text), text };
  } catch {
    return null;
  }
}

/** The export in `file`, or null if it isn't one. */
export async function readExport(file) {
  return (await readExportFile(file))?.exported ?? null;
}

/**
 * Imports the export files the GM chooses to, calling onImported(result, exported) for
 * each, and resolves with the files left to upload. Only for whoever can edit the game
 * (the server refuses the rest anyway): otherwise every file is uploaded. confirmCode
 * (see importEntity) decides on card code from another server; one declined is dropped.
 */
export async function takeDroppedExports(files, { ask, onImported, onError, confirmCode }) {
  if (!ClientMediator.sendCommand("Game", "GetCanEditGame")) return files;

  const rest = [];
  for (const file of files) {
    const read = await readExportFile(file);
    if (!read) {
      rest.push(file);
      continue;
    }
    const { exported, text } = read;
    const answer = await ask(exported, file);
    if (answer === "material") {
      rest.push(file);
    } else if (answer === "import") {
      try {
        // The file's own text: the server checks its signature over it.
        const result = await importEntity(text, { kind: exported.kind, confirmCode });
        if (result) onImported?.(result, exported);
      } catch (e) {
        onError?.(e, exported);
      }
    }
  }
  return rest;
}
