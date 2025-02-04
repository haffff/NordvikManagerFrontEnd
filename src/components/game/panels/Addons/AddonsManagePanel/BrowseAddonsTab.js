import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormLabel,
  HStack,
  Input,
  Stack,
  useToast,
} from "@chakra-ui/react";
import DListItem from "../../../../uiComponents/base/List/DListItem";
import React from "react";
import WebHelper from "../../../../../helpers/WebHelper";
import DContainer from "../../../../uiComponents/base/Containers/DContainer";
import DList from "../../../../uiComponents/base/List/DList";
import DLabel from "../../../../uiComponents/base/Text/DLabel";
import { DUIBox } from "../../../../uiComponents/base/List/DUIBox";
import DListItemButton from "../../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../../../uiComponents/base/List/DListItemsButtonContainer";
import { FaArrowUp, FaCheck, FaDownload } from "react-icons/fa";

export const BrowseAddonsTab = ({ toDownload, addons, handleReload }) => {
  const [installing, setInstalling] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const toast = useToast();
  const Install = async (key) => {
    setInstalling(true);
    var formData = new FormData();
    formData.append("key", key);
    var result = await WebHelper.postAsync("addon/install", formData, true);
    if (result.ok) {
      toast({
        title: "Addon installed",
        status: "success",
        duration: 9000,
        isClosable: true,
      });
    } else {
      toast({
        title: "Addon installation failed",
        status: "error",
        duration: 9000,
        isClosable: true,
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
                <DListItem key={addon.id}>
                  <Box height={100}>
                    {addon.name}
                    {addon.description}
                  </Box>
                  <DListItemsButtonContainer>
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
                  </DListItemsButtonContainer>
                </DListItem>
              );
            })
          : "No addons to download"}
      </DList>
    </>
  );
};
