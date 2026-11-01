import { vi, describe, it, expect } from "vitest";

vi.mock("../../helpers/transport", () => ({ ActiveWebHelper: {} }));
const toaster = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../ui/toaster", () => ({ toaster }));

import { editTokenResource, isTokenResource, tokenEditAction } from "./tokenEditing";

// Edit on a token resource: the token editor opens on it (helpers/tokenEditorLink.js), and
// its "Save to game" overwrites the resource.

const setup = ({ status = 200, body = {}, open } = {}) => {
  const web = {
    getMaterialAsync: vi.fn(async () => new Blob(['{"name":"Zoë"}'], { type: "application/json" })),
    putAsync: vi.fn(async () => ({ status, body })),
  };
  const session = { close: vi.fn() };
  const openEditor = open ?? vi.fn(() => session);
  return { web, openEditor, session };
};
const decode = (base64) => new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));

describe("editTokenResource", () => {
  it("opens the editor on the resource (by id): loads its text as UTF-8, saves it back by id", async () => {
    const { web, openEditor } = setup();
    editTokenResource({ id: "r1", name: "token_hero.json" }, { web, openEditor });
    const { name, load, save } = openEditor.mock.lastCall[0];
    expect(name).toBe("token_hero.json");

    expect(await load()).toBe('{"name":"Zoë"}');
    expect(web.getMaterialAsync).toHaveBeenCalledWith("r1", "application/octet-stream", undefined);

    await save('{"name":"Zoë 2"}');
    const [path, data] = web.putAsync.mock.lastCall;
    expect(path).toBe("Materials/ResourceData");
    expect(data).toMatchObject({ Id: "r1", MimeType: "application/json" });
    expect(decode(data.Content)).toBe('{"name":"Zoë 2"}');
  });

  it("a card's token field holds a resource key: loaded and saved by key", async () => {
    const { web, openEditor } = setup();
    editTokenResource({ key: "myaddon_token_hero.json" }, { web, openEditor });
    const { name, load, save } = openEditor.mock.lastCall[0];
    expect(name).toBe("myaddon_token_hero.json");
    await load();
    expect(web.getMaterialAsync).toHaveBeenCalledWith(undefined, "application/octet-stream", "myaddon_token_hero.json");
    await save("{}");
    expect(web.putAsync.mock.lastCall[1]).toMatchObject({ Key: "myaddon_token_hero.json" });
    expect(web.putAsync.mock.lastCall[1]).not.toHaveProperty("Id");
  });

  it("a field holding a resource id is read as an id", async () => {
    const { web, openEditor } = setup();
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    editTokenResource({ key: id }, { web, openEditor });
    await openEditor.mock.lastCall[0].save("{}");
    expect(web.putAsync.mock.lastCall[1]).toMatchObject({ Id: id });
  });

  it("refuses to save text that isn't a JSON object, and reports the server's refusal", async () => {
    const { web, openEditor } = setup({ status: 403, body: { error: "No Edit permission" } });
    editTokenResource({ id: "r1" }, { web, openEditor });
    const { save } = openEditor.mock.lastCall[0];
    await expect(save("[1]")).rejects.toThrow(/token file/);
    expect(web.putAsync).not.toHaveBeenCalled();
    await expect(save("{}")).rejects.toThrow("No Edit permission");
  });

  it("a resource that can't be read fails the load", async () => {
    const { web, openEditor } = setup();
    web.getMaterialAsync.mockResolvedValue(undefined);
    editTokenResource({ id: "r1" }, { web, openEditor });
    await expect(openEditor.mock.lastCall[0].load()).rejects.toThrow();
  });

  it("a blocked pop-up is shown as a message", () => {
    const { web } = setup();
    const openEditor = vi.fn(() => { throw new Error("The browser blocked the pop-up"); });
    expect(editTokenResource({ id: "r1" }, { web, openEditor })).toBeNull();
    expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: "error", description: "The browser blocked the pop-up" }));
  });
});

describe("isTokenResource", () => {
  it("JSON resources can be token files", () => {
    expect(isTokenResource({ mimeType: "application/json" })).toBe(true);
    expect(isTokenResource({ mimeType: "image/png" })).toBe(false);
    expect(isTokenResource(null)).toBe(false);
  });
});

describe("tokenEditAction (a token field's button)", () => {
  it("opens the token editor on the field's resource", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    tokenEditAction.onClick("myaddon_token_hero.json");
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/client\/tokens\/\?from=game$/), "_blank");
    expect(tokenEditAction.label).toBe("Edit in token editor");
    open.mockRestore();
  });
});
