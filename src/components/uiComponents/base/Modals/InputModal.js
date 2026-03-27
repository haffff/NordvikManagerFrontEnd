import * as React from "react";
import SettingsPanel from "../../../game/settings/SettingsPanel";
import { Button } from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogBody,
  DialogCloseTrigger,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "../../../ui/dialog";

/**
 * InputModal — a generic imperative dialog driven by a config dict.
 *
 * Usage:
 *   const openRef = React.useRef();
 *   openRef.current({ name: "default" });   // opens with pre-filled dto
 *
 * Props:
 *   title         — dialog heading
 *   getConfigDict — () => FieldConfig[]  (called fresh each time the dialog opens)
 *   openRef       — ref that receives the open(dto?) imperative function
 *   onCloseModal  — (dto, success: boolean) => void
 */
export const InputModal = ({ getConfigDict, openRef, onCloseModal, title }) => {
  const [open, setOpen]               = React.useState(false);
  const [configDict, setConfigDict]   = React.useState([]);
  // validationSuccess: null = not yet validated, true/false = result of last check
  const [validationSuccess, setValidationSuccess] = React.useState(null);

  // Single source of truth for the live DTO — kept in a ref so SettingsPanel
  // callbacks always see the latest value without triggering extra renders.
  const dtoRef = React.useRef({});
  // Always call the *latest* getConfigDict without re-creating the open function.
  const getConfigDictRef = React.useRef(getConfigDict);
  React.useLayoutEffect(() => { getConfigDictRef.current = getConfigDict; });

  // Expose the imperative open function to the caller.
  openRef.current = React.useCallback((inputDto) => {
    dtoRef.current = inputDto ?? {};
    setConfigDict(getConfigDictRef.current());
    setValidationSuccess(null);   // reset validation state on each open
    setOpen(true);
  }, []);

  const handleSave = () => {
    // If validation hasn't run yet (null) or explicitly failed, block save.
    if (validationSuccess === false) return;
    onCloseModal(dtoRef.current, true);
    setOpen(false);
  };

  const handleCancel = () => {
    onCloseModal(dtoRef.current, false);
    setOpen(false);
  };

  // Allow Enter to confirm and Escape to cancel from any field inside the dialog.
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === "Escape")               { e.preventDefault(); handleCancel(); }
  };

  return (
    <DialogRoot
      lazyMount
      size="xl"
      open={open}
      onOpenChange={(e) => {
        if (!e.open) handleCancel();
      }}
    >
      <DialogContent onKeyDown={handleKeyDown}>
        <DialogCloseTrigger />
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <SettingsPanel
            dto={dtoRef.current}
            onSave={(dto) => { dtoRef.current = { ...dtoRef.current, ...dto }; }}
            onValidation={(result) => setValidationSuccess(result)}
            editableKeyLabelDict={configDict}
            hideSaveButton
            saveOnLeave
          />
        </DialogBody>

        <DialogFooter>
          <Button
            colorPalette="blue"
            variant="outline"
            isDisabled={validationSuccess === false}
            onClick={handleSave}
          >
            Save
          </Button>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default InputModal;
