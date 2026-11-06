import { vi, describe, it, expect } from "vitest";
import { LINK, connectToGame, openTokenEditor, tokenEditorUrl } from "./tokenEditorLink";

// A game window opens the token editor (on Central) and hands it a token file over
// postMessage; the editor's "Save to game" hands it back, and the game saves it.

const GAME = "http://localhost:8214";
const EDITOR = "https://central.example/client/tokens/";

// A window: an event target that records what was posted to it.
function fakeWindow({ origin, search = "", opener = null } = {}) {
  const win = new EventTarget();
  win.origin = origin;
  win.location = { href: `${origin}/${search}`, search };
  win.opener = opener;
  win.closed = false;
  win.posted = [];
  win.postMessage = vi.fn((data, targetOrigin) => win.posted.push({ data, targetOrigin }));
  win.setInterval = vi.fn(() => 1);
  win.clearInterval = vi.fn();
  return win;
}
// A message arriving in `to` from `from`.
const deliver = (to, from, data) =>
  to.dispatchEvent(Object.assign(new Event("message"), { data, origin: from.origin, source: from }));
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("the editor's side: connectToGame", () => {
  it("not opened by a game: nothing to connect to", () => {
    expect(connectToGame({ win: fakeWindow({ origin: "https://central.example" }), onOpen: vi.fn() })).toBeNull();
    const game = fakeWindow({ origin: GAME });
    expect(connectToGame({ win: fakeWindow({ origin: "https://central.example", opener: game }), onOpen: vi.fn() })).toBeNull();
  });

  it("says it's ready, takes the file only from its opener, and saves back to that origin alone", async () => {
    const game = fakeWindow({ origin: GAME });
    const stranger = fakeWindow({ origin: "https://evil.example" });
    const editor = fakeWindow({ origin: "https://central.example", search: "?from=game", opener: game });
    const onOpen = vi.fn();
    const link = connectToGame({ win: editor, onOpen });

    expect(game.posted).toEqual([{ data: { type: LINK, kind: "ready" }, targetOrigin: "*" }]);

    deliver(editor, stranger, { type: LINK, kind: "open", name: "x", text: "{}" });
    expect(onOpen).not.toHaveBeenCalled();
    deliver(editor, game, { type: LINK, kind: "open", name: "token_hero.json", text: '{"name":"hero"}' });
    expect(onOpen).toHaveBeenCalledWith({ name: "token_hero.json", text: '{"name":"hero"}' });

    const saving = link.save('{"name":"hero2"}');
    const sent = game.posted.at(-1);
    expect(sent).toMatchObject({ data: { type: LINK, kind: "save", text: '{"name":"hero2"}' }, targetOrigin: GAME });
    deliver(editor, stranger, { type: LINK, kind: "saved", id: sent.data.id, ok: false, error: "no" });
    deliver(editor, game, { type: LINK, kind: "saved", id: sent.data.id, ok: true });
    await expect(saving).resolves.toBeUndefined();
  });

  it("a save the game refused fails with its reason", async () => {
    const game = fakeWindow({ origin: GAME });
    const editor = fakeWindow({ origin: "https://central.example", search: "?from=game", opener: game });
    const link = connectToGame({ win: editor, onOpen: vi.fn() });
    deliver(editor, game, { type: LINK, kind: "open", name: "t", text: "{}" });
    const saving = link.save("{}");
    deliver(editor, game, { type: LINK, kind: "saved", id: game.posted.at(-1).data.id, ok: false, error: "No Edit permission" });
    await expect(saving).rejects.toThrow("No Edit permission");
  });

  it("no file from the game yet: nothing to save to", async () => {
    const game = fakeWindow({ origin: GAME });
    const link = connectToGame({ win: fakeWindow({ origin: "https://central.example", search: "?from=game", opener: game }), onOpen: vi.fn() });
    await expect(link.save("{}")).rejects.toThrow();
  });
});

describe("the game's side: openTokenEditor", () => {
  const setup = ({ save = vi.fn(async () => {}) } = {}) => {
    const game = fakeWindow({ origin: GAME });
    const editor = fakeWindow({ origin: "https://central.example" });
    game.open = vi.fn(() => editor);
    const load = vi.fn(async () => '{"name":"hero"}');
    const session = openTokenEditor({ win: game, editorUrl: EDITOR, name: "token_hero.json", load, save });
    return { game, editor, load, save, session };
  };

  it("opens the editor as a game's editor, and sends the file when it's ready, to the editor's origin only", async () => {
    const { game, editor, load } = setup();
    expect(game.open).toHaveBeenCalledWith(`${EDITOR}?from=game`, "_blank");

    deliver(game, fakeWindow({ origin: "https://central.example" }), { type: LINK, kind: "ready" }); // another window
    await flush();
    expect(load).not.toHaveBeenCalled();

    deliver(game, editor, { type: LINK, kind: "ready" });
    await flush();
    expect(editor.posted).toEqual([{ data: { type: LINK, kind: "open", name: "token_hero.json", text: '{"name":"hero"}' }, targetOrigin: "https://central.example" }]);
  });

  it("saves what the editor sends and answers it", async () => {
    const { game, editor, save } = setup();
    deliver(game, editor, { type: LINK, kind: "save", id: 7, text: '{"name":"hero2"}' });
    await flush();
    expect(save).toHaveBeenCalledWith('{"name":"hero2"}');
    expect(editor.posted.at(-1).data).toEqual({ type: LINK, kind: "saved", id: 7, ok: true });
  });

  it("a failed save is answered with its reason", async () => {
    const { game, editor } = setup({ save: vi.fn(async () => { throw new Error("No Edit permission"); }) });
    deliver(game, editor, { type: LINK, kind: "save", id: 1, text: "{}" });
    await flush();
    expect(editor.posted.at(-1).data).toEqual({ type: LINK, kind: "saved", id: 1, ok: false, error: "No Edit permission" });
  });

  it("from another origin, even from the editor's window, nothing is saved", async () => {
    const { game, editor, save } = setup();
    game.dispatchEvent(Object.assign(new Event("message"), { data: { type: LINK, kind: "save", id: 1, text: "{}" }, origin: "https://evil.example", source: editor }));
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("a blocked pop-up is an error", () => {
    const game = fakeWindow({ origin: GAME });
    game.open = vi.fn(() => null);
    expect(() => openTokenEditor({ win: game, editorUrl: EDITOR, name: "t", load: vi.fn(), save: vi.fn() })).toThrow(/pop-up/i);
  });

  it("stops listening once closed", async () => {
    const { game, editor, save, session } = setup();
    session.close();
    deliver(game, editor, { type: LINK, kind: "save", id: 1, text: "{}" });
    await flush();
    expect(save).not.toHaveBeenCalled();
  });
});

describe("tokenEditorUrl", () => {
  it("the editor on Central, unless one is set", () => {
    expect(tokenEditorUrl({ editorUrl: "", centralUrl: "https://central.example" })).toBe("https://central.example/client/tokens/");
    expect(tokenEditorUrl({ editorUrl: "", centralUrl: "" })).toBe("/client/tokens/");
    expect(tokenEditorUrl({ editorUrl: "http://localhost:3004/", centralUrl: "https://central.example" })).toBe("http://localhost:3004/");
  });
});
