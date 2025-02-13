import * as React from "react";
import SettingsPanel from "../../../game/settings/SettingsPanel";
import { Button, Portal } from "@chakra-ui/react";
import { DialogContainer } from "../Containers/DialogContainer";
import {
  DialogRoot,
  DialogContent,
  DialogBody,
  DialogCloseTrigger,
  DialogBackdrop,
  DialogHeader,
  DialogFooter,
} from "../../../ui/dialog";
import ClientMediator from "../../../../ClientMediator";

export const InputModal = ({ getConfigDict, openRef, onCloseModal, title }) => {
  const [open, setOpen] = React.useState(false);
  const [_dto, _setDto] = React.useState({});
  const [validationSuccess, setValidationSuccess] = React.useState(true);
  const [editableKeyLabelDict, setEditableKeyLabelDict] = React.useState([]);
  const [containerRef, setContainerRef] = React.useState(null);

  const _dtoRef = React.useRef();
  _dtoRef.current = _dto;
  openRef.current = (inputDto) => {
    _setDto(inputDto || {});
    let configDict = getConfigDict();
    setEditableKeyLabelDict(configDict);
    setOpen(true);
  };

  React.useState(() => {
    let ref = ClientMediator.sendCommand("Game", "GetContainerRef");
    setContainerRef(ref);
  }, []);

  const validationChange = (result, dto, dictionary) => {
    setValidationSuccess(result);
  };

  return (
    <Portal container={containerRef}>
      <DialogRoot
        lazyMount
        size={"xl"}
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
      >
        <DialogBackdrop />
        <DialogContent>
          <DialogCloseTrigger />
          <DialogHeader>{title}</DialogHeader>
          <DialogBody>
            <SettingsPanel
              dto={_dtoRef.current}
              onSave={(dto) => {
                _setDto({ ..._dtoRef.current, ...dto });
              }}
              onValidation={validationChange}
              editableKeyLabelDict={editableKeyLabelDict}
              hideSaveButton
              saveOnLeave
            />
          </DialogBody>
          <DialogFooter>
            <Button
              colorPalette="blue"
              variant={"outline"}
              mr={3}
              onClick={(e) => {
                if (!validationSuccess) return;
                onCloseModal(_dtoRef.current, true);
                setOpen(false);
              }}
            >
              Save
            </Button>
            <Button
              variant={"outline"}
              onClick={(e) => {
                onCloseModal(_dtoRef.current, false);
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </Portal>
  );
};
export default InputModal;
