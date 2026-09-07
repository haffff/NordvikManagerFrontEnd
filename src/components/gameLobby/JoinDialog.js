import * as React from "react";
import {
  Stack,
  Heading,
  Input,
  Button,
  Icon,
} from "@chakra-ui/react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
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
  const [open, setOpen] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({ password: "" });

  const onFormSubmit = async (customObj) => {
    let sendForm = customObj || createForm;

    let result = await WebHelper.postAsync("gamelist/join", sendForm);

    // WebHelper.postAsync returns undefined (not a rejected promise) on a network
    // error — `result.ok` unguarded threw here, silently aborting with no error
    // toast and no setError(true), on both the manual join form and the
    // auto-join-by-invite-link flow below.
    if (result?.ok) {
      OnSuccess(sendForm.gameID);
      setOpen(false);
      window.history.pushState(document.title, document.title, window.origin);
    } else {
      setError(true);
      toaster.create(UtilityHelper.GenerateJoinProblemToast());
    }
  };

  React.useEffect(() => {
    let params = new URLSearchParams(document.location.search);
    // Support both ?code=... (invite link) and ?iid=... (legacy)
    let inviteCode = params.get("code") ?? params.get("iid");
    let requirePassword = params.get("rp");

    if (inviteCode && !open && !error) {
      if (requirePassword) {
        setCreateForm({ ...createForm, gameID: inviteCode });
        setOpen(true);
      } else {
        onFormSubmit({ gameID: inviteCode });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)}>
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>Join game</DialogHeader>
        <DialogBody>
          <form
            onSubmit={(e) => { e.preventDefault(); onFormSubmit(); }}
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
              <Button
                size="sm"
                variant="ghost"
                alignSelf="flex-start"
                onClick={() => setShowPassword((s) => !s)}
              >
                <Icon as={showPassword ? FaEyeSlash : FaEye} mr={1} />
                {showPassword ? "Hide" : "Show"} password
              </Button>
              <Button type="submit">Join</Button>
            </Stack>
          </form>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};
export default JoinDialog;
