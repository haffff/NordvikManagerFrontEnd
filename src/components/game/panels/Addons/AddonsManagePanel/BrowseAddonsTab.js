import { Box, Flex } from "@chakra-ui/react";
import DListItem from "../../../../uiComponents/base/List/DListItem";
import React from "react";
import WebHelper from "../../../../../helpers/WebHelper";
import DContainer from "../../../../uiComponents/base/Containers/DContainer";
import DList from "../../../../uiComponents/base/List/DList";
import DLabel from "../../../../uiComponents/base/Text/DLabel";
import { DUIBox } from "../../../../uiComponents/base/List/DUIBox";
import DListItemButton from "../../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../../../uiComponents/base/List/DListItemsButtonContainer";
import { FaArrowUp, FaCheck, FaDownload, FaLink } from "react-icons/fa";
import { toaster } from "../../../../ui/toaster";
import DockableHelper from "../../../../../helpers/DockableHelper";
import ClientMediator from "../../../../../ClientMediator";

export const BrowseAddonsTab = ({ toDownload, addons, handleReload }) => {
  const [installing, setInstalling] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const Install = async (key) => {
    setInstalling(true);
    var formData = new FormData();
    formData.append("key", key);
    var result = await WebHelper.postAsync("addon/install", formData, true);
    if (result.ok) {
      toaster.create({
        title: "Addon installed",
        type: "success",
        duration: 9000,
        isClosable: true,
      });
    } else {
      toaster.create({
        title: "Addon installation failed",
        type: "error",
        duration: 9000,
        isClosable: true,
      });

      let json = await result.json();
      console.log(result);
      ClientMediator.sendCommand("Game", "CreateNewPanel", {
        type: "LookupPanel",
        props: {
          name: "Addon install failed",
          content: json,
          contentType: "object",
        },
      });
    }
    handleReload();
    setInstalling(false);
  };

  return (
    <>
      <DList mainComponent={true}>
        {toDownload && toDownload.length > 0
          ? toDownload.map((addon) => {
              const installedAddon = addons.find((x) => x.key === addon.key);
              const isInstalled = installedAddon !== undefined;
              const hasVersionSepcified = addon.version !== undefined;
              const isUpdate =
                isInstalled && installedAddon.version !== addon.version;

              return (
                <DListItem key={addon.id} padding={'10px'}>
                  <Flex flex={"1"} gap={'10px'} direction={'column'} flexGrow={1}>
                    <Box>
                      {addon.name}
                    </Box>
                    <Box>
                      Description: {addon.description}
                    </Box>
                    <Box>
                      Author: {addon.author}
                    </Box>
                    <Box>
                      <a target="_blank"  href={addon.repositoryUrl}><Flex alignItems={'center'} gap='5px' direction={'row'}><FaLink /> Link</Flex></a>
                    </Box>

                  </Flex>
                  <Flex gap={'15px'} direction={'row-reverse'} alignItems={'center'}>
                    {!isInstalled && (
                      <DListItemButton
                        onClick={() => {
                          Install(addon.key);
                        }}
                        label="Download"
                        icon={FaDownload}
                      />
                    )}
                    {!hasVersionSepcified && isInstalled && (
                      <DListItemButton
                        onClick={() => {}}
                        label="Installed"
                        icon={FaCheck}
                      />
                    )}
                    {hasVersionSepcified && isInstalled && isUpdate && (
                      <DListItemButton
                        onClick={() => {}}
                        label="Update"
                        icon={FaArrowUp}
                      />
                    )}
                    <Box width={10}>
                      {hasVersionSepcified && isUpdate && <FaArrowUp />}
                      {addon.version}
                    </Box>
                  </Flex>
                </DListItem>
              );
            })
          : "No addons to download"}
      </DList>
    </>
  );
};
