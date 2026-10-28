import * as React from "react";
import { Button, Text } from "@chakra-ui/react";
import {
  DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "../ui/dialog";
import { toaster } from "../ui/toaster";

// Asks what to do with an Export JSON file dropped onto the battle map or into Materials
// (see helpers/droppedExports.js). Mounted once, next to the Toaster.

const KIND_NAMES = {
  map: "map", card: "card", template: "template", view: "custom view", playlist: "playlist", soundboard: "soundboard",
};

let show = null;

/** Resolves "import", "material" or "cancel"; "material" when no prompt is mounted. */
export function askImportDropped(exported) {
  return new Promise((resolve) => {
    if (!show) resolve("material");
    else show({ exported, resolve });
  });
}

/** The toast after an import: what it made, and the files it didn't find. */
export function reportImported({ missing } = {}, exported) {
  toaster.create({
    title: `Imported "${exported?.name ?? ""}"`,
    description: missing?.length ? `Not in this game, left out: ${missing.join(", ")}` : undefined,
    type: missing?.length ? "warning" : "success",
    duration: missing?.length ? 10000 : 4000,
  });
}

export function reportImportFailed(error) {
  toaster.create({ title: "Couldn't import it", description: error?.message, type: "error" });
}

export const ImportDropPrompt = () => {
  const [request, setRequest] = React.useState(null);

  React.useEffect(() => {
    show = setRequest;
    return () => { show = null; };
  }, []);

  const answer = (value) => {
    request?.resolve(value);
    setRequest(null);
  };

  const kind = KIND_NAMES[request?.exported?.kind] ?? "item";
  return (
    <DialogRoot open={Boolean(request)} onOpenChange={(e) => { if (!e.open && request) answer("cancel"); }}>
      <DialogContent maxW="sm">
        <DialogHeader>
          <DialogTitle>Import "{request?.exported?.name}"?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text fontSize="sm">
            This file is an exported {kind}. Import it into the game, or just add the file to Materials?
          </Text>
        </DialogBody>
        <DialogFooter gap={2}>
          <Button size="sm" variant="outline" onClick={() => answer("material")}>Just add to Materials</Button>
          <Button size="sm" colorPalette="blue" onClick={() => answer("import")}>Import {kind}</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default ImportDropPrompt;
