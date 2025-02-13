import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormLabel,
  HStack,
  Heading,
  Input,
  Stack,
} from "@chakra-ui/react";
import DListItem from "../../../../uiComponents/base/List/DListItem";
import React from "react";
import WebHelper from "../../../../../helpers/WebHelper";
import DContainer from "../../../../uiComponents/base/Containers/DContainer";
import DList from "../../../../uiComponents/base/List/DList";
import DLabel from "../../../../uiComponents/base/Text/DLabel";
import { DUIBox } from "../../../../uiComponents/base/List/DUIBox";

export const BrowseInstalledTab = ({ handleReload, addons }) => {
  const [search, setSearch] = React.useState("");
  const [selectedAddon, setSelectedAddon] = React.useState(null);

  const Uninstall = async (id) => {
    await WebHelper.postAsync("addon/uninstall?addonId=" + id, true);
    handleReload();
  };

  return (
    <>
      <Flex dir="row" overflowY={"auto"} height={"100%"}>
        <DContainer title={"Addons"} width={"300px"} maxWidth={"700px"}>
          <DList mainComponent={true}>
            <Input
              placeholder={"Search"}
              onChange={(e) => setSearch(e.target.value)}
            />
            {addons
              .filter((x) => x.name.includes(search))
              .map((addon) => (
                <DListItem
                  onClick={() => {
                    setSelectedAddon(addon);
                  }}
                  isSelected={selectedAddon?.id === addon.id}
                >
                  <DLabel>{addon.name}</DLabel>
                </DListItem>
              ))}
          </DList>
        </DContainer>
        {selectedAddon ? (
          <Stack key={selectedAddon?.id} padding={"10px"} width={"100%"}>
            <DUIBox>
              <Heading size={'xs'}>{selectedAddon.name}</Heading>
              <table>
                <tr>
                  <td>Description:</td>
                  <td>{selectedAddon.description}</td>
                </tr>
                <tr>
                  <td>Version:</td>
                  <td>{selectedAddon.version}</td>
                </tr>
                <tr>
                  <td>Author:</td>
                  <td>{selectedAddon.author}</td>
                </tr>
                <tr>
                  <td>Website:</td>
                  <td>
                    <a href={selectedAddon.website}>{selectedAddon.website}</a>
                  </td>
                </tr>
                <tr>
                  <td>License:</td>
                  <td>{selectedAddon.license}</td>
                </tr>
                <tr>
                  <Checkbox isChecked={selectedAddon?.isEnabled}>
                    Enabled
                  </Checkbox>
                </tr>
              </table>
            </DUIBox>
            <HStack gap={"10px"}>
              <Button>Update</Button>
              <Button onClick={() => Uninstall(selectedAddon.id)}>Delete</Button>
              <Button>Export</Button>
            </HStack>
          </Stack>
        ) : (
          <></>
        )}
      </Flex>
    </>
  );
};
