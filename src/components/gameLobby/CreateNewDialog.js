import * as React from "react";
import {
  Stack,
  Heading,
  Input,
  Button,
  ButtonGroup,
  Box,
  HStack,
  Image,
  Flex,
  Textarea,
  Dialog,
  DialogCloseTrigger,
} from "@chakra-ui/react";
import WebHelper from "../../helpers/WebHelper";
import { FaLink } from "react-icons/fa";
import DContainer from "../uiComponents/base/Containers/DContainer";
import { DialogContainer } from "../uiComponents/base/Containers/DialogContainer";
import { Checkbox } from "../ui/checkbox";
import { DialogBackdrop, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot } from "../ui/dialog";

export const CreateNewDialog = ({ OnSuccess }) => {
  const [open, setOpen] = React.useState(false);

  const [recommendedAddons, setRecommendedAddons] = React.useState([]);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    passwordRequired: false,
  });

  React.useEffect(() => {
    getRecommendedAddons();
  }, []);

  const getRecommendedAddons = async () => {
    var result = await WebHelper.getAsync("gamelist/GetFeaturedAddons");

    if (result) {
      setRecommendedAddons(result);
    }
  };

  const onFormSubmit = () => {
    WebHelper.post(
      "gamelist/addgame",
      createForm,
      (obj) => {
        OnSuccess(obj);
        setOpen(false);
      },
      (result) => {
        setError(true);
      }
    );
  };

  const setField = (field, value) => {
    setCreateForm({ ...createForm, [field]: value });
  };

  return (
    <>
      <Button
        width={"200px"}
        onClick={() => {
          setCreateForm({});
          setOpen(true);
        }}
        variant={"outline"}
      >
        Create new one
      </Button>
        <DialogRoot
          lazyMount
          open={open}
          onOpenChange={(e) => setOpen(e.open)}
          size={"xl"}
        >
          <DialogBackdrop />
          <DialogContent>
            <DialogCloseTrigger />
            <DialogHeader>Create new game</DialogHeader>
            <DialogBody>
              <form onSubmit={() => {}}>
                <Stack spacing={4} borderColor={error ? "tomato" : "gray.200"}>
                  <Flex gap={"40px"} dir="row">
                    <Stack flex={1}>
                      <Heading size="xs">Title</Heading>
                      <Input
                        placeholder="My epic adventure"
                        size="md"
                        onInput={(input) =>
                          setField("name", input.target.value)
                        }
                      />
                      <Heading size="xs">Password</Heading>
                      <Checkbox
                        onChange={(input) =>
                          setField("passwordRequired", input.target.checked)
                        }
                      >
                        Require Password
                      </Checkbox>
                      <Input
                        type="password"
                        disabled={!createForm.passwordRequired}
                        placeholder="Enter password"
                        size="md"
                        onInput={(input) =>
                          setField("password", input.target.value)
                        }
                      />
                    </Stack>
                    <Stack flex={1}>
                      <Heading size="xs">Image</Heading>
                      {createForm.image && (
                        <Image
                          src={createForm.image}
                          boxSize="100px"
                          objectFit={"contain"}
                        />
                      )}
                      {!createForm.image && (
                        <Box
                          boxSize="100px"
                          display={"flex"}
                          justifyContent={"center"}
                          alignItems={"center"}
                        >
                          Select Image
                        </Box>
                      )}
                      <Input
                        type="file"
                        onChange={(input) => {
                          //convert input to base64
                          var reader = new FileReader();
                          reader.onload = function (e) {
                            // set base64 to form
                            setField("image", e.target.result);
                          };

                          reader.readAsDataURL(input.target.files[0]);
                        }}
                      />
                    </Stack>
                  </Flex>

                  <Heading size="xs">Summary</Heading>
                  <Input
                    placeholder="Short description"
                    size="md"
                    onChange={(e) => setField("summary", e.target.value)}
                  />

                  <Heading size="xs">Description</Heading>
                  <Textarea
                    placeholder="Long description"
                    size="md"
                    onChange={(e) => setField("description", e.target.value)}
                  />

                  <Heading size="xs">Recommended Addons</Heading>
                  <Box>
                    <Stack>
                      {recommendedAddons.map((addon) => (
                        <HStack key={addon.id}>
                          <Checkbox
                            onChange={(e) => {
                              let newAddons = createForm.addons || [];

                              if (e.target.checked) {
                                newAddons.push(addon.key);
                              } else {
                                newAddons = newAddons.filter(
                                  (x) => x !== addon.key
                                );
                              }

                              setField("addons", newAddons);
                            }}
                          >
                            {addon.name}
                            {addon.description && " - " + addon.description}
                          </Checkbox>
                          {addon.website && (
                            <FaLink
                              href={addon.website}
                              title={addon.website}
                            />
                          )}
                        </HStack>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </form>
            </DialogBody>
            <DialogFooter>
              <ButtonGroup>
                <Button colorScheme={"green"} onClick={onFormSubmit}>
                  Create
                </Button>
                <Button onClick={() => setOpen(false)}>Cancel</Button>
              </ButtonGroup>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>
    </>
  );
};
export default CreateNewDialog;
