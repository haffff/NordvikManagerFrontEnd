import { Box, Button, HStack, Input } from "@chakra-ui/react";
import DListItem from "../../../../uiComponents/base/List/DListItem";
import React from "react";
import WebHelper from "../../../../../helpers/WebHelper";
import { toaster } from "../../../../ui/toaster"

export const InstallFromFileTab = ({handleReload}) => {
  const [fileSelected, setFileSelected] = React.useState(false);
  const [url, setUrl] = React.useState("");

  const fileRef = React.useRef(null);
  const inputFile = React.useRef(null);

  const Install = async () => {
    var formData = new FormData();
    formData.append("file", fileRef.current);
    formData.append("url", url);
    var result = await WebHelper.postAsync("addon/install", formData, true);
    if (result.ok) {
      toaster.create({
        title: "Addon installed",
        status: "success",
        duration: 9000,
        isClosable: true,
      });
    } else {
      toaster.create({
        title: "Addon installation failed",
        status: "error",
        duration: 9000,
        isClosable: true,
      });
    }
    handleReload();
  };

  const HandleDrop = (ev) => {
    if (ev.dataTransfer.items) {
      var file = [...ev.dataTransfer.items]
        .find((x) => x.kind === "file")
        .getAsFile();
      if (file) {
        fileRef.current = file;
        setFileSelected(true);
      }
    }
  };

  const HandleSelectFile = () => {
    inputFile.current.click();
  };

  const HandleFileSelected = (e) => {
    if (e.target.files.length > 0) {
      let file = e.target.files[0];
      fileRef.current = file;
      setFileSelected(true);
    }
  };

  return (
    <>
      Drop addon file here:
      <Box
        onDragOver={(ev) => ev.preventDefault()}
        onDrop={(ev) => {
          ev.preventDefault();
          HandleDrop(ev);
        }}
        onClick={HandleSelectFile}
        width={"200px"}
        height={"100px"}
        borderWidth={"2px"}
        borderRadius={"10px"}
        borderStyle={"dashed"}
        alignContent={"center"}
        textAlign={"center"}
      >
        Drop here
      </Box>
      <input
        type="file"
        id="file"
        ref={inputFile}
        onChange={HandleFileSelected}
        style={{ display: "none" }}
      />
      Or provide URL:
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Addon URL"
      />
      {fileSelected && (
        <DListItem>Item selected: {fileRef.current.name}</DListItem>
      )}
      <HStack gap={"10px"}>
        <Button onClick={() => Install()}>Install</Button>
        <Button
          onClick={() => {
            fileRef.current = null;
            setFileSelected(false);
          }}
        >
          Clear
        </Button>
      </HStack>
    </>
  );
};
