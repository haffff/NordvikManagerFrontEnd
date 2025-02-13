import * as React from "react";
import {
  Button,
  useDisclosure,
  ButtonGroup,
  Table,
  Tabs,
  Dialog,
  Box,
  For,
} from "@chakra-ui/react";
import {
  NumberInputRoot,
  NumberInputLabel,
  NumberInputField,
} from "./../ui/number-input";
import WebHelper from "../../helpers/WebHelper";
import { FaCheck, FaLink, FaMailBulk, FaUser } from "react-icons/fa";
import DContainer from "../uiComponents/base/Containers/DContainer";
import { DialogContainer } from "../uiComponents/base/Containers/DialogContainer";
import { LoadingScreen } from "../uiComponents/LoadingScreen";
import { DialogBackdrop, DialogBody, DialogCloseTrigger, DialogContent, DialogFooter, DialogHeader, DialogRoot } from "../ui/dialog";

export const UserManagementDialog = ({ OnSuccess, openRef }) => {
  const [open, setOpen] = React.useState(false);
  const [users, setUsers] = React.useState([]);
  const [page, setPage] = React.useState(0);
  const [invitesPage, setInvitesPage] = React.useState(0);
  const [invites, setInvites] = React.useState([]);
  const [hours, setHours] = React.useState(24);

  openRef.current = () => setOpen(true);

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
    if (open) {
      GetUsers();
    }
  }, [open, page]);

  React.useEffect(() => {
    if (open) {
      GetInvites();
    }
  }, [open, invitesPage]);

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
      <DialogRoot
        size="cover"
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
      >
        <DialogBackdrop />
        <DialogContent>
          <DialogCloseTrigger />
          <DialogHeader>User Management</DialogHeader>
          <DialogBody>
            <Tabs.Root defaultValue={"users"} lazyMount>
              <Tabs.List>
                <Tabs.Trigger value={"users"}>
                  <FaUser />
                  Users
                </Tabs.Trigger>
                <Tabs.Trigger value={"invites"}>
                  <FaMailBulk />
                  Invites
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value={"users"}>
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Username</Table.ColumnHeader>
                      <Table.ColumnHeader>Email</Table.ColumnHeader>
                      <Table.ColumnHeader>Admin</Table.ColumnHeader>
                      <Table.ColumnHeader>Actions</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    <For
                      each={users}
                      fallback={<Table.Row><LoadingScreen /></Table.Row>}
                    >
                      {(user) => (
                        <Table.Row key={user.id}>
                          <Table.Cell>{user.userName}</Table.Cell>
                          <Table.Cell>{user.email}</Table.Cell>
                          <Table.Cell>
                            {user.isAdmin ? <FaCheck /> : <></>}
                          </Table.Cell>
                          <Table.Cell>
                            <ButtonGroup>
                              {/* <Button>Edit</Button> */}
                              <Button variant={'outline'} onClick={() => DeleteUser(user.id)}>
                                Delete
                              </Button>
                            </ButtonGroup>
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </For>
                  </Table.Body>
                  <Table.Footer>
                    <Table.Row>
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell>
                        <ButtonGroup>
                          <Button variant={'outline'} onClick={() => page > 0 && setPage(page - 1)}>
                            -
                          </Button>
                          <Button variant={'outline'} onClick={() => setPage(page + 1)}>+</Button>
                        </ButtonGroup>
                      </Table.Cell>
                    </Table.Row>
                  </Table.Footer>
                </Table.Root>
              </Tabs.Content>
              <Tabs.Content value="invites">
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Code</Table.ColumnHeader>
                      <Table.ColumnHeader>Expires</Table.ColumnHeader>
                      <Table.ColumnHeader>Url</Table.ColumnHeader>
                      <Table.ColumnHeader>Actions</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    <For each={invites} fallback={<Table.Row></Table.Row>}>
                    {(invite) => {
                      let expires = new Date(invite.value);
                      let simpleDateTime =
                        expires.toLocaleDateString() +
                        " " +
                        expires.toLocaleTimeString();

                      let codeShort = invite.key.substring(0, 5) + "...";
                      return (
                        <Table.Row key={invite.key}>
                          <Table.Cell
                            onClick={() => CopyCode(invite, false)}
                            title={invite.key}
                          >
                            {codeShort}
                          </Table.Cell>
                          <Table.Cell>{simpleDateTime}</Table.Cell>
                          <Table.Cell>
                            <Button variant={'outline'} onClick={() => CopyCode(invite, true)}>
                              Copy
                            </Button>
                          </Table.Cell>
                          <Table.Cell>
                            <ButtonGroup>
                              {/* <Button>Edit</Button> */}
                              <Button variant={'outline'} onClick={() => DeleteInvite(invite.key)}>
                                Delete
                              </Button>
                            </ButtonGroup>
                          </Table.Cell>
                        </Table.Row>
                      );
                    }}
                    </For>
                  </Table.Body>
                  <Table.Footer>
                    <Table.Row>
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell colSpan={2}>
                        <ButtonGroup>
                          <NumberInputRoot
                            value={hours}
                            onChange={(e, n) => setHours(n)}
                            defaultValue="24"
                            width="200px"
                          >
                            <NumberInputLabel>Hours</NumberInputLabel>
                            <NumberInputField />
                          </NumberInputRoot>
                          <Button variant={'outline'} onClick={GenerateInvite}>Create</Button>
                          <Button variant={'outline'}
                            onClick={() =>
                              invitesPage > 0 && setInvitesPage(invitesPage - 1)
                            }
                          >
                            -
                          </Button>
                          <Button variant={'outline'}
                            onClick={() => setInvitesPage(invitesPage + 1)}
                          >
                            +
                          </Button>
                        </ButtonGroup>
                      </Table.Cell>
                    </Table.Row>
                  </Table.Footer>
                </Table.Root>
              </Tabs.Content>
            </Tabs.Root>
          </DialogBody>
          <DialogFooter>
            <ButtonGroup>
              <Button variant={'outline'} onClick={() => setOpen(false)}>Cancel</Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
  );
};
