import { ActiveWebHelper } from "../../helpers/transport";
import { openTokenEditor } from "../../helpers/tokenEditorLink";
import { toaster } from "../ui/toaster";

// "Edit in token editor" on a token resource (Resources panel, a card's or template's
// token field): the token editor opens on it in a new tab, and its "Save to game"
// overwrites the resource here. Tokens already on a map keep what they were built from;
// tokens placed after the save use the new file.

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resources that can be token files. */
export const isTokenResource = (item) => item?.mimeType === "application/json";

const utf8ToBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

// A Blob's text, as UTF-8.
const readText = (blob) =>
  typeof blob.text === "function"
    ? blob.text()
    : new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });

/** A token field's button (SettingsPanel editAction): its resource in the token editor. */
export const tokenEditAction = {
  label: "Edit in token editor",
  onClick: (value) => editTokenResource({ key: value }),
};

/**
 * Opens the token editor on a resource, by id or by key (a token field holds either).
 * @returns the editor session, or null when it couldn't open (the reason is shown).
 */
export function editTokenResource({ id, key, name }, { web = ActiveWebHelper, openEditor = openTokenEditor } = {}) {
  if (!id && GUID.test(key ?? "")) [id, key] = [key, undefined];
  const ref = id ? { Id: id } : { Key: key };
  try {
    return openEditor({
      name: name ?? key ?? "",
      async load() {
        // As bytes: the text-typed answer isn't decoded as UTF-8.
        const data = await web.getMaterialAsync(id, "application/octet-stream", key);
        if (data === undefined || data === null) throw new Error("The token file couldn't be read.");
        return typeof data === "string" ? data : await readText(data);
      },
      async save(text) {
        let value;
        try {
          value = JSON.parse(text);
        } catch {
          value = null;
        }
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("That isn't a token file (a JSON object).");
        const resp = await web.putAsync("Materials/ResourceData", { ...ref, Content: utf8ToBase64(text), MimeType: "application/json" });
        if (!resp || resp.status >= 300) throw new Error(resp?.body?.error ?? `Saving failed (HTTP ${resp?.status ?? "no answer"})`);
      },
    });
  } catch (err) {
    toaster.create({ type: "error", title: "Couldn't open the token editor", description: String(err?.message ?? err) });
    return null;
  }
}
