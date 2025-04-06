import * as React from "react";
import LayoutHelper from "../../../../helpers/LayoutCloneHelper";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import WebSocketManagerInstance from "../../WebSocketManager";
import CommandFactory from "../../../BattleMap/Factories/CommandFactory";
import { FaBook } from "react-icons/fa";
import LayoutsManagerPanel from "../../panels/LayoutsManagerPanel";
import DropDownMenu from "../../../uiComponents/base/DDItems/DropDownMenu";
import DropDownItem from "../../../uiComponents/base/DDItems/DropDownItem";
import DropDownSeparator from "../../../uiComponents/base/DDItems/DropDownSeparator";
import CreateDropDownButton from "../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton";
import DeletableDropDownButton from "../../../uiComponents/base/DDItems/SpecialButtons/DeletableDropDownButton";
import ClientMediator from "../../../../ClientMediator";
import CollectionSyncer from "../../../uiComponents/base/CollectionSyncer";
import WebHelper from "../../../../helpers/WebHelper";
import InputModal from "../../../uiComponents/base/Modals/InputModal";

export const LayoutsMenu = ({ state, battlemapsRef }) => {
  const width = 200;
  const [serverLayouts, setServerLayouts] = React.useState(undefined);

  const openRef = React.createRef();

  React.useEffect(() => {
    WebHelper.get("Battlemap/GetLayouts", setServerLayouts);
    const id = UtilityHelper.GenerateUUID();
  }, []);

  function DeleteServerLayout({ id }) {
    WebSocketManagerInstance.Send(CommandFactory.CreateLayoutRemoveCommand(id));
  }

  return (
    <DropDownMenu viewId={"layouts"} width={width} name={"Layouts"}>
      <DropDownItem
        width={width}
        name={"Save current"}
        onClick={() => {
          openRef.current({ name: "My new layout" });
        }}
      />

      <DropDownSeparator title="Layouts" />

      {serverLayouts !== undefined && serverLayouts !== null ? (
        serverLayouts.map((x) => (
          <DeletableDropDownButton
            id={x.id}
            key={x.id}
            width={width}
            name={x.name}
            onClick={() =>
              ClientMediator.sendCommand("Game", "SetLayout", x?.id)
            }
            onDeleteClick={() => DeleteServerLayout(x)}
          />
        ))
      ) : (
        <></>
      )}

      <DropDownSeparator />
      <CreateDropDownButton
        gmOnly
        icon={FaBook}
        width={width}
        name={"Layout Manager"}
        state={state}
        element={<LayoutsManagerPanel state={state} />}
      />
      <CollectionSyncer
        incrementalUpdate={true}
        collection={serverLayouts}
        setCollection={setServerLayouts}
        commandPrefix={"layout"}
      />
      <InputModal
        openRef={openRef}
        title={"Save current layout"}
        getConfigDict={() => [
          {
            key: "name",
            required: true,
            label: "Name",
            toolTip: "Name of layout.",
            type: "string",
          },
        ]}
        onCloseModal={(data, success) => {
          if (success) {
            let rootPanel = state.ref.current.rootPanel;
            let clone = LayoutHelper.GetCloneForSaving(
              rootPanel,
              battlemapsRef
            );
            let newObj = {
              name: data.name,
              value: JSON.stringify(clone),
            };
            let cmd = CommandFactory.CreateLayoutAddCommand(newObj);
            WebSocketManagerInstance.Send(cmd);
          }
        }}
      />
    </DropDownMenu>
  );
};
export default LayoutsMenu;
