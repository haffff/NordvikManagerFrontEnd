import * as React from "react";
import { Tabs, TabList, Tab, TabPanels, TabPanel } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import WebSocketManagerInstance from "../WebSocketManager";
import SettingsPanel from "./SettingsPanel";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import Subscribable from "../../uiComponents/base/Subscribable";
import SecuritySettingsPanel from "./SecuritySettingsPanel";
import BasePanel from "../../uiComponents/base/BasePanel";
import WebHelper from "../../../helpers/WebHelper";

export const LayoutSettingsPanel = ({ layoutId }) => {
  const [ layout, setLayout ] = React.useState({});

  const editables = [
    { key: "name", label: "Name", toolTip: "Name of layout.", type: "string" },
    {
      key: "visibleToOnly",
      label: "Visible to only",
      toolTip: "If set only selected players can see this layout.",
      type: "playerArray",
    },
    {
      key: "default",
      label: "Is default",
      toolTip: "Default layout",
      type: "boolean",
    },
  ];


  React.useEffect(() => {
    const getLayout = async () => {
      let response = await WebHelper.getAsync(`battlemap/GetLayout?id=${layoutId}`);
      setLayout({...response});
    ctx.setTitle(`Layout Settings - ${layout.name}`);
    };

    getLayout();
  } , [layoutId]);

  const ctx = Dockable.useContentContext();

  if (layout === undefined) {
    ctx.setTitle(`Layout Settings - Empty`);
    return <></>;
  } else {
    ctx.setTitle(`Layout Settings - ${layout.name}`);
  }

  ctx.setPreferredSize(600,800);

  const sendSettingsUpdate = (dtoToSend) => {
    dtoToSend.id = layout.id;
    dtoToSend.gameModelId = layout.gameModelId;
    let command = CommandFactory.CreateLayoutUpdateCommand(dtoToSend);
    WebSocketManagerInstance.Send(command);
  };

  const updateSettings = (event) => {
    setLayout({...layout, ...event.data});
  };

  return (
    <Subscribable commandPrefix={"layout_update"} onMessage={updateSettings}>
      <BasePanel>
        <Tabs.Root defaultValue={'settings'} marginTop={3} size="md" variant="enclosed">
          <Tabs.List>
            <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
            <Tabs.Trigger value="permissions">Permissions</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="settings">
            <SettingsPanel key={layout?.id + "_settings"}
              dto={layout}
              editableKeyLabelDict={editables}
              onSave={sendSettingsUpdate}
            />
          </Tabs.Content>
          <Tabs.Content value="permissions">
            <SecuritySettingsPanel dto={layout} type="LayoutModel" key={layout?.id + "_perms"} />
          </Tabs.Content>
        </Tabs.Root>
      </BasePanel>
    </Subscribable>
  );
};
export default LayoutSettingsPanel;
