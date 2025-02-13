import * as React from "react";
import { Button, ButtonGroup, Box, Dialog } from "@chakra-ui/react";
import WebHelper from "../../helpers/WebHelper";
import { FaLink } from "react-icons/fa";
import DContainer from "../uiComponents/base/Containers/DContainer";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";

export const AppSettingsDialog = ({ OnSuccess, openRef }) => {
  const [open, setOpen] = React.useState(false);
  const [recommendedAddons, setRecommendedAddons] = React.useState([]);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    passwordRequired: false,
  });

  openRef.current = () => setOpen(true);

  React.useEffect(() => {}, []);

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
          <form onSubmit={() => {}}></form>
        </DialogBody>
        <Dialog.Footer>
          <ButtonGroup>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
          </ButtonGroup>
        </Dialog.Footer>
      </DialogContent>
    </DialogRoot>
  );
};
