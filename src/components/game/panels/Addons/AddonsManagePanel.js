import * as React from "react";
import {
  TabPanels,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Box,
  Input,
  Button,
  Checkbox,
  Flex,
  useToast,
  HStack,
  FormLabel,
  Stack,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import WebHelper from "../../../../helpers/WebHelper";
import BasePanel from "../../../uiComponents/base/BasePanel";
import DContainer from "../../../uiComponents/base/Containers/DContainer";
import DListItem from "../../../uiComponents/base/List/DListItem";
import DListItemsButtonContainer from "../../../uiComponents/base/List/DListItemsButtonContainer";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { FaDumpster, FaMinus } from "react-icons/fa";
import DLabel from "../../../uiComponents/base/Text/DLabel";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import DList from "../../../uiComponents/base/List/DList";
import { DUIBox } from "../../../uiComponents/base/List/DUIBox";

export const AddonsManagePanel = ({ state }) => {
  const forceUpdate = React.useReducer((x) => x + 1, 0)[1];
  const [addons, setAddons] = React.useState([]);
  const [fileSelected, setFileSelected] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [selectedAddon, setSelectedAddon] = React.useState(null);

  const fileRef = React.useRef(null);

  const toast = useToast();

  const inputFile = React.useRef(null);
  React.useEffect(() => {
    HandleReload();
  }, []);

  const HandleReload = async () => {
    var result = await WebHelper.getAsync("addon/addons");
    setAddons(result);
  };

  const Install = async () => {
    var formData = new FormData();
    formData.append("file", fileRef.current);
    formData.append("url", url);
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
    HandleReload();
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

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Addons Manage Panel`);

  return (
    <BasePanel>
      <Tabs>
        <TabList>
          <Tab>Installed</Tab>
          <Tab>Install</Tab>
          {/* <Tab>Create</Tab> */}
        </TabList>
        <TabPanels>
          <TabPanel>
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
                    <FormLabel>{selectedAddon.name}</FormLabel>
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
                          <a href={selectedAddon.website}>
                            {selectedAddon.website}
                          </a>
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
                    <Button>Delete</Button>
                    <Button>Export</Button>
                  </HStack>
                </Stack>
              ) : (
                <></>
              )}
            </Flex>
          </TabPanel>
          <TabPanel>
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
          </TabPanel>
          {/* <TabPanel>
                        <DContainer title={"Information"} withVisibilityToggle >
                            <DLabel>Name</DLabel>
                            <Input placeholder="Addon Name" onChange={(e) => setCreateAddon({ ...createAddon, Name: e.target.value })} />
                            <DLabel>Description</DLabel>
                            <Input placeholder="Addon Description" onChange={(e) => setCreateAddon({ ...createAddon, Description: e.target.value })} />
                            <DLabel>Version</DLabel>
                            <Input placeholder="Addon Version" onChange={(e) => setCreateAddon({ ...createAddon, Version: e.target.value })} />
                            <DLabel>Author</DLabel>
                            <Input placeholder="Addon Author" onChange={(e) => setCreateAddon({ ...createAddon, Author: e.target.value })} />
                            <DLabel>Website</DLabel>
                            <Input placeholder="Addon URL" onChange={(e) => setCreateAddon({ ...createAddon, Website: e.target.value })} />
                            <DLabel>License</DLabel>
                            <Input placeholder="Addon License" onChange={(e) => setCreateAddon({ ...createAddon, License: e.target.value })} />
                        </DContainer>
                        <DContainer maxHeight={'300px'} title={"Actions"} withVisibilityToggle >
                            <Flex>
                                <Input placeholder="Prefix" onChange={(e) => { setPrefix(e.target.value) }} width={'200px'} />
                                <Input placeholder="Name" onChange={(e) => { setName(e.target.value) }} />
                                <Button onClick={() => { actions.filter(x => x.prefix.includes(prefix) && x.name.includes(name)).forEach(x => x.selected = true); forceUpdate() }}>Select</Button>
                                <Button onClick={() => { actions.filter(x => x.prefix.includes(prefix) && x.name.includes(name)).forEach(x => x.selected = false); forceUpdate() }}>Deselect</Button>
                            </Flex>

                            {actions.filter(x => x.prefix.includes(prefix) && x.name.includes(name)).map((action, index) => (<DListItem key={action.id + action.selected}><Checkbox defaultChecked={action.selected} onChange={(e) => { action.selected = e.target.checked; forceUpdate() }} style={{ paddingRight: '25px' }}>{action.name}</Checkbox> <i style={{ color: "rgb(100,100,100)" }}>{action.description}</i></DListItem>))}
                            {<div>Selected {actions.filter(x => x.selected).length} actions.</div>}
                        </DContainer>
                        <DContainer maxHeight={'300px'} title={"Views"} withVisibilityToggle >
                            {panels.map((panel, index) => (<DListItem key={panel.id + panel.selected}><Checkbox onChange={(e) => { panel.selected = e.target.checked; forceUpdate() }} defaultChecked={panel.selected} style={{ paddingRight: '25px' }}>{panel.name}</Checkbox> <i style={{ color: "rgb(100,100,100)" }}>{panel.description}</i></DListItem>))}
                            {<div>Selected {panels.filter(x => x.selected).length} views.</div>}
                        </DContainer>
                        <Button onClick={
                            () => {
                                createAddon.GameId = gameDataRef.current?.Game?.id;
                                createAddon.Actions = actions.filter(x => x.selected).map(x => x.id);
                                createAddon.Views = panels.filter(x => x.selected).map(x => x.id);
                                createAddon.Resources = [];
                                WebHelper.post("addon/createaddon", { ...createAddon }, (response) => { UtilityHelper.DownloadObjectAsFile(response, createAddon.Name) }, (error) => console.log(error));
                            }}>Create</Button>
                        <Button onClick={HandleReload}>Reload</Button>
                    </TabPanel> */}
        </TabPanels>
      </Tabs>
    </BasePanel>
  );
};
export default AddonsManagePanel;
