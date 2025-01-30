import * as React from 'react';
import LayoutHelper from '../../../../helpers/LayoutCloneHelper';
import UtilityHelper from '../../../../helpers/UtilityHelper';
import WebSocketManagerInstance from '../../WebSocketManager';
import CommandFactory from '../../../BattleMap/Factories/CommandFactory';
import { FaBook } from 'react-icons/fa';
import LayoutsManagerPanel from '../../panels/LayoutsManagerPanel';
import DropDownMenu from '../../../uiComponents/base/DDItems/DropDownMenu';
import DropDownItem from '../../../uiComponents/base/DDItems/DropDownItem';
import DropDownSeparator from '../../../uiComponents/base/DDItems/DropDownSeparator';
import CreateDropDownButton from '../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton';
import DeletableDropDownButton from '../../../uiComponents/base/DDItems/SpecialButtons/DeletableDropDownButton';
import ClientMediator from '../../../../ClientMediator';
import CollectionSyncer from '../../../uiComponents/base/CollectionSyncer';
import WebHelper from '../../../../helpers/WebHelper';

export const LayoutsMenu = ({
    state,
    battlemapsRef,
}) => {
    const width = 200;
    const [serverLayouts, setServerLayouts] = React.useState(undefined);
    const [clientLayouts, setClientLayouts] = React.useState(undefined);

    React.useEffect(() => {
        WebHelper.get("Battlemap/GetLayouts",setServerLayouts);
    }, []);


    if (clientLayouts === undefined) {

        let layouts = localStorage.getItem("Layouts");
        if (!layouts) {
            layouts = "[]";
        }

        let layoutArr = JSON.parse(layouts);


        setClientLayouts(layoutArr);
    }


    function SaveClientLayout(val) {
        let uuid = UtilityHelper.GenerateUUID();
        let layouts = localStorage.getItem("Layouts");
        if (!layouts) {
            layouts = "[]";
        }

        let layoutArr = JSON.parse(layouts);
        layoutArr.push({ uuid: uuid, name: "Layout", value: JSON.stringify(val) });
        localStorage.setItem("Layouts", JSON.stringify(layoutArr));
        setClientLayouts(layoutArr);
    }

    function DeleteClientLayout(uuid) {
        let layouts = localStorage.getItem("Layouts");
        let layoutArr = JSON.parse(layouts);
        let newArr = layoutArr.filter(x => x.uuid !== uuid);
        localStorage.setItem("Layouts", JSON.stringify(newArr));
        setClientLayouts(newArr);
    }

    function DeleteServerLayout({id}) {
        WebSocketManagerInstance.Send(CommandFactory.CreateLayoutRemoveCommand(id));
    }

    return (
        <DropDownMenu viewId={"layouts"} width={width} name={"Layouts"}>
            <DropDownMenu submenu={true} width={width} name={"Local"}>
                <DropDownItem width={width} name={"Save current"} onClick={() => {
                    let rootPanel = state.ref.current.rootPanel;
                    let clone = LayoutHelper.GetCloneForSaving(rootPanel, battlemapsRef);
                    SaveClientLayout(clone);
                }} />

                <DropDownSeparator title="Layouts" />

                {clientLayouts !== undefined && clientLayouts !== null ? clientLayouts.map(x => <DeletableDropDownButton key={x.uuid}
                    width={width}
                    name={x.name}
                    onClick={() => ClientMediator.sendCommand("Game", "SetLayout", x)}
                    onDeleteClick={() => DeleteClientLayout(x.uuid)} />) : <></>}
            </DropDownMenu>

            <DropDownMenu width={width} name={"Game"} submenu={true}>
                <DropDownItem width={width} name={"Save current"} onClick={() => {
                    let rootPanel = state.ref.current.rootPanel;
                    let clone = LayoutHelper.GetCloneForSaving(rootPanel, battlemapsRef);
                    let newObj = { name: "Server Layout", value: JSON.stringify(clone) };
                    let cmd = CommandFactory.CreateLayoutAddCommand(newObj);
                    WebSocketManagerInstance.Send(cmd);
                }} />

                <DropDownSeparator title="Layouts" />

                {serverLayouts !== undefined && serverLayouts !== null ? serverLayouts.map(x => <DeletableDropDownButton key={x.id} width={width} name={x.name} onClick={() => ClientMediator.sendCommand("Game", "SetLayout", x)} onDeleteClick={() => DeleteServerLayout(x)} />) : <></>}
            </DropDownMenu>
            <DropDownItem width={width} name={"Reset"} />
            <CreateDropDownButton gmOnly icon={FaBook} width={width} name={"Layout Manager"} state={state} element={<LayoutsManagerPanel state={state} />} />
            <CollectionSyncer collection={serverLayouts} setCollection={setServerLayouts} commandPrefix={"layout"} />
        </DropDownMenu>
    );
}
export default LayoutsMenu;