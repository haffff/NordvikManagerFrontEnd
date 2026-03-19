import * as React from "react";
import { Button } from "@chakra-ui/react";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";

export const AppSettingsDialog = ({ openRef }) => {
  const [open, setOpen] = React.useState(false);

  openRef.current = () => setOpen(true);

  return (
    <DialogRoot
      lazyMount
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      size={"cover"}
    >
      <DialogBackdrop />
      <DialogContent>
        <DialogCloseTrigger />
        <DialogHeader>Application Settings</DialogHeader>
        <DialogBody>
          {/* TODO: add app settings fields */}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default AppSettingsDialog;
