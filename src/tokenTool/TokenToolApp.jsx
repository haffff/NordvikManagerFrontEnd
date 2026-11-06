import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { Button, Flex, Heading, Text } from "@chakra-ui/react";
import "../stylesheets/dock.css";
import { useDockModifier } from "../helpers/dockSettings";
import { BLANK_TOKEN, EditorContext, createEditorStore, useEditor } from "./editorStore";
import { VisibilitySwitchesView, PartsView, PictureView, PreviewView, QuickEditFieldsView, SampleValuesView, TokenFileView } from "./panels/toolPanels";
import character from "./fixtures/token_character.json";
import { connectToGame } from "../helpers/tokenEditorLink";

// The token editor (/client/tokens/): a token file drawn by the real token renderer,
// with sample values for the properties it reads, in the game's own dock: Parts and
// Quick-edit fields and Visibility switches (tabs) on the left, the preview in the middle, the file, sample values and
// the picture on the right.
// Nothing leaves the browser, except to the game that opened the editor (Edit on a
// token resource): its file comes in, and "Save to game" hands it back.

// token_<name>.json, the way addons name their token files.
const fileName = (definition) => `token_${String(definition?.name ?? "token").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "token"}.json`;

function FileBar({ onResetLayout, game }) {
  const [{ text, error, definition, notice }, { edit, applyText, setNotice }] = useEditor();

  // The file as written in the box (the user's own formatting), named after the token.
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName(definition);
    link.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied.");
    } catch {
      setNotice("The browser didn't allow copying: select the text in the Token file panel instead.");
    }
  };
  const saveToGame = async () => {
    try {
      await game.save(text);
      setNotice("Saved to the game.");
    } catch (err) {
      setNotice(`Not saved: ${err?.message ?? err}`);
    }
  };
  const openFile = async (file) => {
    if (file) applyText(await file.text());
  };

  return (
    <Flex as="header" gap="8px" wrap="wrap" align="center" px="12px" py="6px" borderBottomWidth="1px" borderColor="border" flexShrink="0">
      <Heading size="sm" mr="8px">Token editor</Heading>
      {game?.name != null && (
        <>
          <Text fontSize="12px" title="Opened from a game: Save to game writes this resource there.">From the game: <b>{game.name || "token"}</b></Text>
          <Button size="xs" variant="solid" disabled={!!error} onClick={saveToGame}>Save to game</Button>
        </>
      )}
      <Button size="xs" variant="outline" onClick={() => edit(structuredClone(BLANK_TOKEN))}>New blank token</Button>
      <Button size="xs" variant="outline" onClick={() => edit(character)}>dnd5e example</Button>
      <Button size="xs" variant="outline" asChild>
        <label style={{ cursor: "pointer" }}>
          Open…
          <input type="file" accept=".json,application/json" aria-label="Open token file" hidden onChange={(e) => openFile(e.target.files?.[0])} />
        </label>
      </Button>
      <Button size="xs" variant="outline" disabled={!!error} onClick={download}>Download</Button>
      <Button size="xs" variant="outline" onClick={copy}>Copy</Button>
      {notice && <Text fontSize="12px" color="fg.muted">{notice}</Text>}
      <Button size="xs" variant="ghost" ml="auto" onClick={onResetLayout}
        title="Put the panels back where they started (a closed panel comes back). The token file is kept.">
        Reset layout
      </Button>
    </Flex>
  );
}

function ToolDock() {
  const dockModifier = useDockModifier();
  const state = Dockable.useDockable((s) => {
    // Full docking moves the content into the root and hands back an emptied panel, so
    // the next panels dock against the root's own split panels.
    Dockable.createDockedPanel(s, s.rootPanel, Dockable.DockMode.Full, <PreviewView />);
    Dockable.createDockedPanel(s, s.rootPanel, Dockable.DockMode.Left, <PartsView />);
    s.rootPanel.splitSize = 0.28; // Parts | the rest
    // Quick-edit fields and Visibility switches as tabs next to Parts.
    const parts = s.rootPanel.splitPanels[0];
    Dockable.addNewContent(s, parts, <QuickEditFieldsView />);
    Dockable.addNewContent(s, parts, <VisibilitySwitchesView />);
    parts.currentTabIndex = 0;
    const preview = s.rootPanel.splitPanels[1];
    const right = Dockable.createDockedPanel(s, preview, Dockable.DockMode.Right, <TokenFileView />);
    preview.splitSize = 0.55; // Preview | Token file and the other tabs
    Dockable.addNewContent(s, right, <SampleValuesView />);
    Dockable.addNewContent(s, right, <PictureView />);
    right.currentTabIndex = 0;
  });
  return (
    <Flex className="nm_dock" flex="1" minH="0" overflow="hidden">
      <Dockable.Container state={state} dockModifier={dockModifier} />
    </Flex>
  );
}

export default function TokenToolApp({ connect = connectToGame }) {
  const [store] = React.useState(() => createEditorStore(character));
  // Opened from a game: the file it sent (its name), and the way back.
  const [game, setGame] = React.useState(null);
  React.useEffect(() => {
    const link = connect({
      onOpen: ({ name, text }) => {
        store.actions.applyText(text);
        setGame({ name, save: (t) => link.save(t) });
      },
    });
    return () => link?.dispose();
  }, [connect, store]);
  // A new dock, as it started: the editor's state lives in the store, so nothing is lost.
  const [layout, setLayout] = React.useState(0);
  return (
    <EditorContext.Provider value={store}>
      <Flex id="NordvikManagerMain" direction="column" h="100vh" bg="bg" color="fg">
        <FileBar onResetLayout={() => setLayout((n) => n + 1)} game={game} />
        <ToolDock key={layout} />
      </Flex>
    </EditorContext.Provider>
  );
}
