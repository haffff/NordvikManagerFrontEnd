import { Box, Button, Center, Heading, Input, Stack } from "@chakra-ui/react";
import React from "react";
import { toaster } from '../ui/toaster';
import WebHelper from "../../helpers/WebHelper";

export const RegisterForm = ({ OnSuccess, code }) => {
  const [form, setForm] = React.useState({ inviteCode: code });
  const [error, setError] = React.useState(false);
  const [codeError, setCodeError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  const precheckRegistrationCode = async () => {
    if (!code) {
      return false;
    }

    let response = await WebHelper.getAsync(
      "user/CheckRegistrationKey?key=" + code
    );

    if (!response) {
      setCodeError(true);
      return false;
    }

    return true;
  };

  React.useEffect(() => {
    precheckRegistrationCode();
  }, []);

  const setField = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const onFormSubmit = () => {
    if (form.password !== form.confirmPassword) {
      setError(true);
      return;
    }

    WebHelper.post(
      "user/register",
      form,
      () => {
        toaster.create({
          title: "Account created.",
          description: "We've created your account for you.",
          status: "success",
          duration: 9000,
          isClosable: true,
        });
        
        //remove "code" parameter from query string
        window.history.replaceState({}, document.title, window.location.pathname);
      },
      (r) => {
        r.json().then((data) => {
          console.log(data.message?.split("\r\n"));
          setErrorMessage(data.message?.split("\r\n"));
        });
      }
    );
  };

  if (codeError) {
    return (
      <Center alignItems={"center"} height={"100vh"}>
        <Heading as="h6" size="xs">
          Registration code is invalid
        </Heading>
      </Center>
    );
  }

  return (
    <form
      onKeyUp={(e) => {
        if (e.key == "Enter") {
          onFormSubmit();
        }
      }}
      onSubmit={() => {}}
      style={{ width: "400px", margin: "0 auto", marginTop: "50px" }}
    >
      {errorMessage && (
        <Box margin={15} as="h6" size="xs" color="red.500">
          {errorMessage.map(x=> <div>{x}</div>)}
        </Box>
      )}
      <Stack spacing={4} borderColor={error ? "tomato" : "gray.200"}>
        <Heading as="h6" size="xs">
          Login
        </Heading>
        <Input
          placeholder="Login"
          size="md"
          value={form.UserName}
          onInput={(input) => setField("UserName", input.target.value)}
        />
        <Heading as="h6" size="xs">
          Password
        </Heading>
        <Input
          pr="4.5rem"
          type="password"
          value={form.password}
          placeholder="Enter password"
          onInput={(input) => setField("password", input.target.value)}
        />

        <Heading as="h6" size="xs">
          Confirm Password
        </Heading>
        <Input
          pr="4.5rem"
          type="password"
          value={form.confirmPassword}
          placeholder="Enter password"
          onInput={(input) => setField("confirmPassword", input.target.value)}
        />

        <Heading as="h6" size="xs">
          Email
        </Heading>
        <Input
          pr="4.5rem"
          type="text"
          value={form.email}
          placeholder="Enter email"
          onInput={(input) => setField("email", input.target.value)}
        />

        <Heading as="h6" size="xs">
          Invite code
        </Heading>
        <Input
          pr="4.5rem"
          type="text"
          placeholder="Code"
          value={form.inviteCode}
          disabled={code}
          onInput={(input) => setField("code", input.target.value)}
          borderColor={code && !codeError ? "green" : "gray.200"}
        />
        <Button onClick={onFormSubmit}>Register</Button>
      </Stack>
    </form>
  );
};
