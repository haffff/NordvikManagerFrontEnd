import React, { useRef, useState } from "react";
import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { FaFile } from "@react-icons/all-files/fa/FaFile";
import { FaUpload } from "@react-icons/all-files/fa/FaUpload";
import { ActiveWebHelper as WebHelper } from "../../../../../helpers/transport";
import { toaster } from "../../../../ui/toaster";
import UtilityHelper from "../../../../../helpers/UtilityHelper";
import ProgressToastManager from "../../../../../helpers/ProgressToastManager";
import addonOpLog from "../../../../../helpers/addonOpLog";
import themeColors from "../../../../../helpers/themeColors";

export const InstallFromFileTab = ({ handleReload }) => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [installing, setInstalling] = useState(false);
  const inputFileRef = useRef(null);

  const handleFile = (f) => {
    if (f) setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = [...(e.dataTransfer.items ?? [])].find((x) => x.kind === "file")?.getAsFile();
    if (f) handleFile(f);
  };

  const installFromFile = async () => {
    if (!file) return;
    setInstalling(true);
    const fileName = file.name;
    try {
      const b64 = await UtilityHelper.ConvertBlobToB64(file);
      addonOpLog(`installFromFile "${fileName}" (${b64.length} base64 chars) clicked`);
      const { status, body } = await WebHelper.postAsync("addon/installFromFile", {
        fileName,
        data: b64,
        mimeType: file.type || "application/zip",
      });
      addonOpLog(`installFromFile "${fileName}" answered ${status}`, body);
      if (status >= 200 && status < 300 && body?.operationId) {
        setFile(null);
        // Reload the addon list once the install finishes — the toast itself tracks progress.
        ProgressToastManager.track(body.operationId, { title: `Installing ${fileName}…` })
          .then(() => handleReload()).catch(() => {});
      } else {
        toaster.create({ title: "Installation failed", type: "error", duration: 6000 });
      }
    } catch (e) {
      toaster.create({ title: "Installation failed", description: e.message, type: "error", duration: 6000 });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Flex direction="column" padding="12px" gap="16px" height="100%" overflow="auto">
      {/* File drop zone */}
      <Flex direction="column" gap="8px">
        <Text fontSize="sm" opacity={0.7}>Install from file</Text>
        <Box
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputFileRef.current?.click()}
          width="100%"
          minHeight="100px"
          borderWidth="2px"
          borderRadius="8px"
          borderStyle="dashed"
          borderColor={isDragging ? themeColors.accent : "gray.600"}
          backgroundColor={isDragging ? "rgba(59,130,246,0.08)" : "transparent"}
          cursor="pointer"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexDirection="column"
          gap="8px"
          transition="all 0.15s"
          _hover={{ borderColor: "gray.400" }}
        >
          {file ? (
            <>
              <FaFile size={20} />
              <Text fontSize="sm">{file.name}</Text>
              <Text fontSize="xs" opacity={0.5}>{(file.size / 1024).toFixed(1)} KB</Text>
            </>
          ) : (
            <>
              <FaUpload size={20} style={{ opacity: 0.4 }} />
              <Text fontSize="sm" opacity={0.5}>Drop a file or click to browse</Text>
            </>
          )}
        </Box>
        <input
          type="file"
          ref={inputFileRef}
          onChange={(e) => handleFile(e.target.files?.[0])}
          style={{ display: "none" }}
        />
        <HStack gap="8px">
          <Button
            size="sm"
            onClick={installFromFile}
            disabled={!file || installing}
            loading={installing}
          >
            Install
          </Button>
          {file && (
            <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
              Clear
            </Button>
          )}
        </HStack>
      </Flex>
    </Flex>
  );
};
