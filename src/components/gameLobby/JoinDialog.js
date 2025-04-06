import * as React from "react";
import {
  Stack,
  Heading,
  Input,
  Button,
  Modal,
  ModalBody,
  useDisclosure,
  ModalHeader,
  ModalOverlay,
  ModalContent,
  Dialog,
} from "@chakra-ui/react";
import { InputGroup } from "../ui/input-group";
import WebHelper from "../../helpers/WebHelper";
import UtilityHelper from "../../helpers/UtilityHelper";
import { toaster } from "../ui/toaster";
import {
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";

export const JoinDialog = ({ OnSuccess }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({ password: "" });
  const onFormSubmit = async (customObj) => {
    let sendForm = customObj || createForm;

    let result = await WebHelper.postAsync("gamelist/join", sendForm);

    if (result.ok) {
      OnSuccess(sendForm.gameID);
      onClose();
      window.history.pushState(document.title, document.title, window.origin);
    } else {
      setError(true);
      toaster.create(UtilityHelper.GenerateJoinProblemToast());
    }
  };

  React.useEffect(() => {
    let params = new URLSearchParams(document.location.search);
    let inviteId = params.get("iid");
    let requirePassword = params.get("rp");

    if (inviteId && !isOpen && !error) {
      if (requirePassword) {
        setCreateForm({ ...createForm, gameID: inviteId });
        onOpen();
      } else {
        onFormSubmit({ gameID: inviteId });
      }
    }
  }, []);

  return (
    <>
      <DialogRoot isOpen={isOpen} onClose={onClose}>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>Join game</DialogHeader>
          <DialogBody>
            <form
              onSubmit={() => {}}
              style={{ width: "400px", margin: "0 auto", marginTop: "50px" }}
            >
              <Stack spacing={4} borderColor={error ? "tomato" : "gray.200"}>
                <Heading as="h6" size="xs">
                  Password
                </Heading>
                <InputGroup size="md">
                  <Input
                    pr="4.5rem"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    onInput={(input) =>
                      setCreateForm({
                        ...createForm,
                        password: input.target.value,
                      })
                    }
                    borderColor={error ? "tomato" : "gray.200"}
                  />
                </InputGroup>
                <Button onClick={() => onFormSubmit()}>Join</Button>
              </Stack>
            </form>
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
export default JoinDialog;
