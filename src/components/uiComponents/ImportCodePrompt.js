import * as React from "react";
import { Button, List, Text } from "@chakra-ui/react";
import {
  DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "../ui/dialog";

// Asks the GM before importing a file from another server (or one changed since it was
// exported) that brings its own card code: a card's page runs the Card API with the rights
// of whoever opens it, so that code would run as the GM. The server sends what it found
// (transfer/Import's 409 inspection); see helpers/entityTransfer.js. Mounted once, next to
// the Toaster.

let show = null;

/** Resolves true to import the code, false not to; false when no prompt is mounted. */
export function askImportCode(inspection) {
  return new Promise((resolve) => {
    if (!show) resolve(false);
    else show({ inspection, resolve });
  });
}

export const ImportCodePrompt = () => {
  const [request, setRequest] = React.useState(null);

  React.useEffect(() => {
    show = setRequest;
    return () => { show = null; };
  }, []);

  const answer = (value) => {
    request?.resolve(value);
    setRequest(null);
  };

  const inspection = request?.inspection;
  return (
    <DialogRoot role="alertdialog" open={Boolean(request)} onOpenChange={(e) => { if (!e.open && request) answer(false); }}>
      <DialogContent maxW="md">
        <DialogHeader>
          <DialogTitle>Import code from another server?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text fontSize="sm" mb={2}>
            "{inspection?.name}" wasn't exported by this server, or was changed after it was. It brings its own
            code for these cards:
          </Text>
          <List.Root fontSize="sm" mb={2} ps={5}>
            {(inspection?.code ?? []).map((card, i) => (
              <List.Item key={i}>
                <Text as="span" fontWeight="semibold">{card.card}</Text>: {card.files.join(", ")}
              </List.Item>
            ))}
          </List.Root>
          <Text fontSize="sm">
            A card's page runs with the rights of whoever opens it, so this code would run with yours as GM. Import it
            only if you trust where the file came from.
          </Text>
        </DialogBody>
        <DialogFooter gap={2}>
          <Button size="sm" variant="outline" onClick={() => answer(false)}>Don't import</Button>
          <Button size="sm" colorPalette="red" onClick={() => answer(true)}>Import anyway</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default ImportCodePrompt;
