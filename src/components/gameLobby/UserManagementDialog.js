import * as React from "react";
import {
  Button,
  ButtonGroup,
  Table,
  Tabs,
  Box,
  For,
  HStack,
} from "@chakra-ui/react";
import WebHelper from "../../helpers/WebHelper";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaLink,
  FaMailBulk,
  FaPlus,
  FaUser,
} from "react-icons/fa";
import { LoadingScreen } from "../uiComponents/LoadingScreen";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";
import { DDataTable } from "../uiComponents/DDataTable";
import { Tooltip } from "../ui/tooltip";

export const UserManagementDialog = ({ OnSuccess, openRef }) => {
  const [open, setOpen] = React.useState(false);
  const [hours, setHours] = React.useState(24);
  const [usersInfo, setUsersInfo] = React.useState(undefined);
  const [invitesInfo, setInvitesInfo] = React.useState(undefined);

  openRef.current = () => setOpen(true);

  const DeleteUser = async (userID) => {
    let result = await WebHelper.deleteAsync("user/deleteuser", {
      userID: userID,
    });
    await GetUsers(usersInfo.page);
  };

  const DeleteInvite = async (key) => {
    let result = await WebHelper.deleteAsync("user/deleteinvite?key=" + key);
    await GetInvites(invitesInfo.page);
  };

  const GetUsers = async (page) => {
    if (usersInfo && (usersInfo.totalPages < page || page < 0)) {
      return;
    }

    const result = await WebHelper.getAsync("user/users?page=" + page);

    setUsersInfo(result);
  };

  const GetInvites = async (page) => {
    if (invitesInfo && (invitesInfo.totalPages < page || page < 0)) {
      return;
    }

    const result = await WebHelper.getAsync("user/invites?page=" + page);

    setInvitesInfo(result);
  };

  const GenerateInvite = async () => {
    let result = await WebHelper.getAsync("user/GenerateInvite?hours=" + hours);
    await GetInvites(invitesInfo.page);
  };

  React.useEffect(() => {
    if (open) {
      GetUsers(1);
      GetInvites(1);
    }
  }, [open]);

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
    <DialogRoot size="cover" open={open} onOpenChange={(e) => setOpen(e.open)}>
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
              <DDataTable
                {...usersInfo}
                GenerateHeader={(header) => (
                  <>
                    {" "}
                    <Table.ColumnHeader>Username</Table.ColumnHeader>
                    <Table.ColumnHeader>Email</Table.ColumnHeader>
                    <Table.ColumnHeader>Admin</Table.ColumnHeader>
                    <Table.ColumnHeader></Table.ColumnHeader>
                  </>
                )}
                GenerateRow={(user) => (
                  <Table.Row key={user.id}>
                    <Table.Cell>{user.userName}</Table.Cell>
                    <Table.Cell>{user.email}</Table.Cell>
                    <Table.Cell>
                      {user.isAdmin ? <FaCheck /> : <></>}
                    </Table.Cell>
                    <Table.Cell>
                      <ButtonGroup>
                        {/* <Button>Edit</Button> */}
                        <Button
                          variant={"outline"}
                          onClick={() => DeleteUser(user.id)}
                        >
                          Delete
                        </Button>
                      </ButtonGroup>
                    </Table.Cell>
                  </Table.Row>
                )}
                GetData={GetUsers}
                fallback={<LoadingScreen />}
              />
            </Tabs.Content>
            <Tabs.Content value="invites">
              <DDataTable
                {...invitesInfo}
                GenerateHeader={(header) => (
                  <>
                    <Table.ColumnHeader>Code</Table.ColumnHeader>
                    <Table.ColumnHeader>Expires</Table.ColumnHeader>
                    <Table.ColumnHeader>Url</Table.ColumnHeader>
                    <Table.ColumnHeader>
                      <Tooltip content="Generate Invite">
                        <Button variant="outline" size="xs" onClick={() => {
                          GenerateInvite();
                        }}>
                          <FaPlus />
                        </Button>
                      </Tooltip>
                    </Table.ColumnHeader>
                  </>
                )}
                GenerateRow={(invite) => {
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
                        <Button
                          variant={"outline"}
                          onClick={() => CopyCode(invite, true)}
                        >
                          Copy
                        </Button>
                      </Table.Cell>
                      <Table.Cell>
                        <ButtonGroup>
                          {/* <Button>Edit</Button> */}
                          <Button
                            variant={"outline"}
                            onClick={() => DeleteInvite(invite.key)}
                          >
                            Delete
                          </Button>
                        </ButtonGroup>
                      </Table.Cell>
                    </Table.Row>
                  );
                }}
                GetData={GetInvites}
              />
            </Tabs.Content>
          </Tabs.Root>
        </DialogBody>
        <DialogFooter>
          <ButtonGroup>
            <Button variant={"outline"} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
