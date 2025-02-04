import * as React from "react";
import {
  Stack,
  Heading,
  Input,
  InputGroup,
  InputRightElement,
  Button,
  Modal,
  ModalBody,
  useDisclosure,
  ModalHeader,
  ModalOverlay,
  ModalContent,
  Checkbox,
  ButtonGroup,
  Box,
  Wrap,
  WrapItem,
  HStack,
  ModalFooter,
  Image,
  Flex,
  Textarea,
} from "@chakra-ui/react";
import WebHelper from "../../helpers/WebHelper";
import { FaLink } from "react-icons/fa";
import DContainer from "../uiComponents/base/Containers/DContainer";

export const CreateNewDialog = ({ OnSuccess }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
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
        onClose();
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
          onOpen();
        }}
      >
        Create new one
      </Button>
      <Modal isOpen={isOpen} onClose={onClose} size={"5xl"}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create new game</ModalHeader>
          <ModalBody>
            <form onSubmit={() => {}}>
              <Stack spacing={4} borderColor={error ? "tomato" : "gray.200"}>
                <Flex gap={"40px"} dir="row">
                  <Stack flex={1}>
                    <Heading as="h6" size="xs">
                      Title
                    </Heading>
                    <Input
                      placeholder="My epic adventure"
                      size="md"
                      onInput={(input) => setField("name", input.target.value)}
                    />
                    <Heading as="h6" size="xs">
                      Password
                    </Heading>
                    <Checkbox
                      defaultChecked={false}
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
                    <Heading as="h6" size="xs">
                      Image
                    </Heading>
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

                <Heading as="h6" size="xs">
                  Summary
                </Heading>
                <Input
                  placeholder="Short description"
                  size="md"
                  onChange={(e) => setField("summary", e.target.value)}
                />

                <Heading as="h6" size="xs">
                  Description
                </Heading>
                <Textarea
                  placeholder="Long description"
                  size="md"
                  onChange={(e) => setField("description", e.target.value)}
                />

                <Heading as="h6" size="xs">
                  Recommended Addons
                </Heading>
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
                        </Checkbox>{" "}
                        {addon.website && (
                          <FaLink href={addon.website} title={addon.website} />
                        )}
                      </HStack>
                    ))}
                  </Stack>
                </Box>
                <ModalFooter>
                  <ButtonGroup>
                    <Button colorScheme={"green"} onClick={onFormSubmit}>
                      Create
                    </Button>
                    <Button onClick={onClose}>Cancel</Button>
                  </ButtonGroup>
                </ModalFooter>
              </Stack>
            </form>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};
export default CreateNewDialog;
