// The game ↔ token editor link. The game opens the editor (served by Central at
// /client/tokens/, so usually another origin) in a new tab and hands it a token file over
// postMessage; the editor's "Save to game" hands the edited file back and the game saves
// it. A URL can't carry a whole token file; a message can.
//
//   editor → game   { kind: "ready" }                     (no data: sent to any origin)
//   game → editor   { kind: "open", name, text }          (to the editor's origin)
//   editor → game   { kind: "save", id, text }            (to the origin the file came from)
//   game → editor   { kind: "saved", id, ok, error? }
//
// Each side only listens to the other window (event.source) at its origin: the game to
// the tab it opened, at the editor's origin; the editor to its opener, at the origin the
// file came from. The file is only drawn and edited there, never run.

export const LINK = "nordvik-token-editor";

const isLink = (data) => data?.type === LINK && typeof data.kind === "string";

/** Where the token editor is: REACT_APP_TOKEN_EDITOR_URL, else Central's /client/tokens/. */
export function tokenEditorUrl({
  editorUrl = process.env.REACT_APP_TOKEN_EDITOR_URL,
  centralUrl = process.env.REACT_APP_CENTRAL_URL,
} = {}) {
  return editorUrl || `${centralUrl ?? ""}/client/tokens/`;
}

/**
 * The editor's side. Opened by a game (?from=game, with an opener): says it's ready and
 * calls onOpen({ name, text }) with the game's file. Otherwise null.
 * @returns {{ save(text): Promise<void>, dispose() } | null}
 */
export function connectToGame({ win = window, onOpen }) {
  const opener = win.opener;
  if (!opener || new URLSearchParams(win.location.search).get("from") !== "game") return null;

  let gameOrigin = null;
  let nextId = 0;
  const pending = new Map();

  const onMessage = (event) => {
    if (event.source !== opener || !isLink(event.data)) return;
    const { kind } = event.data;
    if (kind === "open" && typeof event.data.text === "string") {
      gameOrigin = event.origin;
      onOpen({ name: String(event.data.name ?? ""), text: event.data.text });
    } else if (kind === "saved" && event.origin === gameOrigin) {
      const done = pending.get(event.data.id);
      if (!done) return;
      pending.delete(event.data.id);
      if (event.data.ok) done.resolve();
      else done.reject(new Error(event.data.error || "The game didn't save the file."));
    }
  };
  win.addEventListener("message", onMessage);
  opener.postMessage({ type: LINK, kind: "ready" }, "*");

  return {
    save(text) {
      if (!gameOrigin || opener.closed) return Promise.reject(new Error("The game's window is gone."));
      const id = ++nextId;
      const answer = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      opener.postMessage({ type: LINK, kind: "save", id, text }, gameOrigin);
      return answer;
    },
    dispose() {
      win.removeEventListener("message", onMessage);
      pending.clear();
    },
  };
}

/**
 * The game's side: opens the editor on one token file. load() gives the file's text
 * (each time the editor asks: a reload gets the saved file); save(text) stores it.
 * @returns {{ close() }}
 */
export function openTokenEditor({ win = window, editorUrl = tokenEditorUrl(), name, load, save }) {
  const url = new URL(editorUrl, win.location.href);
  url.searchParams.set("from", "game");
  // Not "noopener": the editor answers through window.opener.
  const editor = win.open(url.href, "_blank");
  if (!editor) throw new Error("The browser blocked the token editor's pop-up: allow pop-ups for this page.");
  const origin = url.origin;

  const reply = (data) => editor.postMessage({ type: LINK, ...data }, origin);
  const onMessage = async (event) => {
    if (event.source !== editor || event.origin !== origin || !isLink(event.data)) return;
    const { kind, id, text } = event.data;
    if (kind === "ready") {
      reply({ kind: "open", name, text: await load() });
    } else if (kind === "save" && typeof text === "string") {
      try {
        await save(text);
        reply({ kind: "saved", id, ok: true });
      } catch (err) {
        reply({ kind: "saved", id, ok: false, error: String(err?.message ?? err) });
      }
    }
  };
  win.addEventListener("message", onMessage);
  // Stop listening once the editor's tab is closed.
  const timer = win.setInterval(() => { if (editor.closed) close(); }, 2000);
  function close() {
    win.clearInterval(timer);
    win.removeEventListener("message", onMessage);
  }
  return { close };
}
