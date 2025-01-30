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
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Tfoot,
  Tabs,
  TabList,
  TabPanel,
  TabPanels,
  Tab,
  NumberInput,
  NumberInputField,
} from "@chakra-ui/react";
import WebHelper from "../../helpers/WebHelper";
import { FaCheck, FaLink } from "react-icons/fa";
import DContainer from "../uiComponents/base/Containers/DContainer";

export const UserManagementDialog = ({ OnSuccess, openRef }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [users, setUsers] = React.useState([]);
  const [page, setPage] = React.useState(0);
  const [invitesPage, setInvitesPage] = React.useState(0);
  const [invites, setInvites] = React.useState([]);
  const [hours, setHours] = React.useState(24);

  openRef.current = onOpen;

  const DeleteUser = async (userID) => {
    let result = await WebHelper.deleteAsync("user/deleteuser", {
      userID: userID,
    });
    await GetUsers();
  };

  const DeleteInvite = async (key) => {
    let result = await WebHelper.deleteAsync("user/deleteinvite?key=" + key);
    await GetInvites();
  };

  const GetUsers = async () => {
    let result = await WebHelper.getAsync("user/users?page=" + page);

    if (result.length === 0 && page > 0) {
      setPage(page - 1);
      return;
    }

    setUsers(result);
  };

  const GetInvites = async () => {
    let result = await WebHelper.getAsync("user/invites?page=" + invitesPage);

    if (result.length === 0 && invitesPage > 0) {
      setInvitesPage(invitesPage - 1);
      return;
    }

    setInvites(result);
  };

  const GenerateInvite = async () => {
    let result = await WebHelper.getAsync("user/GenerateInvite?hours=" + hours);
    await GetInvites();
  };

  React.useEffect(() => {
    if (isOpen) {
      GetUsers();
    }
  }, [isOpen, page]);

  React.useEffect(() => {
    if (isOpen) {
      GetInvites();
    }
  }, [isOpen, invitesPage]);

  const CopyCode = (invite, url = true) => {
    const textToCopy = url
      ? (process.env.REACT_APP_BASE_URL + "?code=" || "") + invite.key
      : invite.key;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
    } else {
      prompt("Copy this code", textToCopy);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size={"5xl"}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>User Management</ModalHeader>
          <ModalBody>
            <Tabs>
              <TabList>
                <Tab>Users</Tab>
                <Tab>Invites</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Username</Th>
                        <Th>Email</Th>
                        <Th>Admin</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {users?.map((user) => {
                        return (
                          <Tr key={user.id}>
                            <Td>{user.userName}</Td>
                            <Td>{user.email}</Td>
                            <Td>{user.isAdmin ? <FaCheck /> : <></>}</Td>
                            <Td>
                              <ButtonGroup>
                                {/* <Button>Edit</Button> */}
                                <Button onClick={() => DeleteUser(user.id)}>
                                  Delete
                                </Button>
                              </ButtonGroup>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                    <Tfoot>
                      <Tr>
                        <Td></Td>
                        <Td></Td>
                        <Td></Td>
                        <Td>
                          <ButtonGroup>
                            <Button
                              onClick={() => page > 0 && setPage(page - 1)}
                            >
                              -
                            </Button>
                            <Button onClick={() => setPage(page + 1)}>+</Button>
                          </ButtonGroup>
                        </Td>
                      </Tr>
                    </Tfoot>
                  </Table>
                </TabPanel>
                <TabPanel>
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Code</Th>
                        <Th>Expires</Th>
                        <Th>Url</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {invites?.map((invite) => {
                        let expires = new Date(invite.value);
                        let simpleDateTime =
                          expires.toLocaleDateString() +
                          " " +
                          expires.toLocaleTimeString();

                        let codeShort = invite.key.substring(0, 5) + "...";
                        return (
                          <Tr key={invite.key}>
                            <Td
                              onClick={() => CopyCode(invite, false)}
                              title={invite.key}
                            >
                              {codeShort}
                            </Td>
                            <Td>{simpleDateTime}</Td>
                            <Td>
                              <Button onClick={() => CopyCode(invite, true)}>
                                Copy
                              </Button>
                            </Td>
                            <Td>
                              <ButtonGroup>
                                {/* <Button>Edit</Button> */}
                                <Button
                                  onClick={() => DeleteInvite(invite.key)}
                                >
                                  Delete
                                </Button>
                              </ButtonGroup>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                    <Tfoot>
                      <Tr>
                        <Td></Td>
                        <Td></Td>
                        <Td colSpan={2}>
                          <ButtonGroup>
                            <NumberInput
                              value={hours}
                              onChange={(e, n) => setHours(n)}
                            >
                              <NumberInputField placeholder="Number of hours" />
                            </NumberInput>
                            <Button onClick={GenerateInvite}>Create</Button>
                            <Button
                              onClick={() =>
                                invitesPage > 0 &&
                                setInvitesPage(invitesPage - 1)
                              }
                            >
                              -
                            </Button>
                            <Button
                              onClick={() => setInvitesPage(invitesPage + 1)}
                            >
                              +
                            </Button>
                          </ButtonGroup>
                        </Td>
                      </Tr>
                    </Tfoot>
                  </Table>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <ButtonGroup>
              <Button onClick={onClose}>Cancel</Button>
            </ButtonGroup>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
