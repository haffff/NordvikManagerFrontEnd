import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Stack,
  Text,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import React from "react";
import CollectionSyncer from "./base/CollectionSyncer";
import RefreshInfo from "./treeList/RefreshInfoCard";
import DTreeViewOnly from "./treeList/DTreeViewOnly";
import WebHelper from "../../helpers/WebHelper";
import {
  FaCode,
  FaImage,
  FaMinus,
  FaMusic,
  FaStickyNote,
} from "react-icons/fa";
import DListItem from "./base/List/DListItem";
import DListItemsButtonContainer from "./base/List/DListItemsButtonContainer";
import DListItemButton from "./base/List/ListItemDetails/DListItemButton";
import Subscribable from "./base/Subscribable";

export const MaterialChooser = ({
  onSelect,
  multipleSelection,
  additionalFilter,
  materialsSelected,
  isDisabled,
}) => {
  const [selectedMaterials, setSelectedMaterials] = React.useState([]);
  const [materials, setMaterials] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [uploadedId, setUploadedId] = React.useState(undefined);

  const LoadData = (then) => {
    WebHelper.get(
      "materials/getresources",
      (response) => {
        setMaterials(response);
        materialsSelected = materialsSelected || [];
        setSelectedMaterials(
          response.filter((x) => materialsSelected?.includes(x.id))
        );

        if (then && then instanceof Function) {
          then();
        }
      },
      (error) => console.log(error)
    );
  };

  const selectedMaterialsRef = React.useRef(selectedMaterials);
  selectedMaterialsRef.current = selectedMaterials;

  React.useEffect(() => {
    LoadData();
  }, []);

  const [showSelect, setShowSelect] = React.useState(false);
  const [selectedInTreeView, setSelectedInTreeView] = React.useState(false);

  const GetIconByMimeType = (mimeType) => {
    if (!mimeType) {
      return <></>;
    }
    if (mimeType.startsWith("application")) {
      return <FaCode />;
    }
    if (mimeType.startsWith("image")) {
      return <FaImage />;
    }
    if (mimeType.startsWith("plain")) {
      return <FaStickyNote />;
    }
    if (mimeType.startsWith("audio")) {
      return <FaMusic />;
    }

    return <></>;
  };

  const HandleDrop = (ev) => {
    ev.preventDefault();
    if (ev.dataTransfer.items) {
      let localMaterials = [];

      [...ev.dataTransfer.items].forEach((item, i) => {
        if (item.kind === "string") {
          let dragObj = JSON.parse(sessionStorage.getItem("draggable"));
          if (dragObj.entityType === "ResourceModel") {
            //Set selected material to provided one
            let selectedMaterial = materials.find((x) => x.id === dragObj.id);
            localMaterials.push(selectedMaterial);
          }
        }

        if (item.kind === "file") {
          WebHelper.postMaterial(
            item.getAsFile(),
            `dropped`,
            (result) => {
              LoadData(() => {
                let selectedMaterial = materials.find(
                  (x) => x.id === result.id
                );
                localMaterials.push(selectedMaterial);
                setUploadedId(localMaterials);
              });
            },
            (error) => {
              console.error(error);
            }
          );
        }
      });
    }
  };

  return (
    <Box>
      <Subscribable onMessage={LoadData} commandPrefix={"resource_notify"} />
      <CollectionSyncer
        collection={materials}
        setCollection={setMaterials}
        commandPrefix={"resource"}
      />
      {selectedMaterials &&
        selectedMaterials.map((selectedMaterial) => (
          <DListItem width={"300px"}>
            {GetIconByMimeType(selectedMaterial.mimeType)}
            <Text marginLeft={"15px"}>{selectedMaterial.name}</Text>
            <DListItemsButtonContainer>
              <DListItemButton
                isDisabled={isDisabled}
                icon={FaMinus}
                color={"red"}
                onClick={() => {
                  setSelectedMaterials(
                    selectedMaterials.filter(
                      (x) => x.id !== selectedMaterial.id
                    )
                  );
                  onSelect(
                    selectedMaterials
                      .filter((x) => x.id !== selectedMaterial.id)
                      .map((x) => x.id)
                  );
                }}
              />
            </DListItemsButtonContainer>
          </DListItem>
        ))}

      {showSelect ? (
        <>
          <Stack maxH={"300px"} overflow={"auto"}>
            <RefreshInfo
              onRefresh={LoadData}
              commandPrefix={"resource_notify"}
            />
            <DTreeViewOnly
              additionalFilter={additionalFilter}
              generateItem={(item, treeItem) => (
                <DListItem
                  isSelected={selectedMaterials?.includes(item.id)}
                  width={"300px"}
                >
                  {GetIconByMimeType(item.mimeType)}
                  <Text marginLeft={"15px"}>{item.name}</Text>
                </DListItem>
              )}
              items={materials}
              entityType={"ResourceModel"}
              onSelect={(item) => {
                !item.isFolder
                  ? setSelectedInTreeView(item)
                  : setSelectedInTreeView(undefined);
              }}
            />
            <Box
              borderWidth={"thin"}
              borderColor={"grey"}
              borderStyle={"dashed"}
              onDrop={HandleDrop}
              width={"300px"}
              height={"50px"}
              onDragOver={(ev) => {
                ev.preventDefault();
              }}
              onDragEnter={(ev) => {
                ev.preventDefault();
              }}
            >
              <Flex
                pointerEvents={"none"}
                color={"grey"}
                flex={1}
                justify={"center"}
                alignContent={"center"}
              >
                drop files here to upload
              </Flex>
            </Box>
          </Stack>
          {multipleSelection ? (
            <HStack>
              <Button
                width={"300px"}
                marginTop={5}
                isDisabled={
                  !selectedInTreeView ||
                  isDisabled ||
                  selectedMaterials.find(
                    (x) => x.id === selectedInTreeView.targetId
                  )
                }
                size={"xs"}
                onClick={() => {
                  onSelect([
                    ...selectedMaterialsRef.current.map((x) => x.id),
                    selectedInTreeView?.itemRef.id,
                  ]);
                  setSelectedMaterials([
                    ...selectedMaterialsRef.current,
                    selectedInTreeView?.itemRef,
                  ]);
                }}
              >
                Add
              </Button>
              <Button
                width={"300px"}
                marginTop={5}
                size={"xs"}
                onClick={() => {
                  setShowSelect(false);
                }}
              >
                Close
              </Button>
            </HStack>
          ) : (
            <Button
              marginTop={5}
              isDisabled={!selectedInTreeView || isDisabled}
              size={"xs"}
              onClick={() => {
                onSelect(selectedInTreeView?.itemRef?.id);
                setShowSelect(false);
                setSelectedMaterials([selectedInTreeView?.itemRef]);
              }}
            >
              Select
            </Button>
          )}
        </>
      ) : (
        <Button
          size={"xs"}
          marginTop={"5px"}
          onClick={() => {
            setShowSelect(true);
          }}
        >
          Select Material
        </Button>
      )}
    </Box>
  );
};

export default MaterialChooser;
