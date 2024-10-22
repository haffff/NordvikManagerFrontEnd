import * as React from 'react';
import { Flex, Circle, FormLabel, HStack, Input, Select, Checkbox, Stack, Card, CardBody, Textarea } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import Subscribable from '../../../uiComponents/base/Subscribable';
import DList from '../../../uiComponents/base/List/DList';
import WebSocketManagerInstance from '../../WebSocketManager';
import WebHelper from '../../../../helpers/WebHelper';
import DContainer from '../../../uiComponents/base/Containers/DContainer';
import DListItem from '../../../uiComponents/base/List/DListItem';
import DLabel from '../../../uiComponents/base/Text/DLabel';
import SettingsPanel from '../../settings/SettingsPanel';
import BasePanel from '../../../uiComponents/base/BasePanel';
import DListItemButton from '../../../uiComponents/base/List/ListItemDetails/DListItemButton';
import { FaMinus } from 'react-icons/fa';
import DListItemsButtonContainer from '../../../uiComponents/base/List/DListItemsButtonContainer';
import CreateDropDownButton from '../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton';
import DockableHelper from '../../../../helpers/DockableHelper';

export const CustomViewsPanel = ({ gameDataRef, state }) => {
    const editableDict = [
        { key: "name", label: "UI Name", type: "string" },
        { key: "description", label: "Description", type: "textarea" },
        {
            key: "content", label: "Content", type: "custom", customComponent: (key,dto, onChange) => (
                <>
                    <Textarea rows={10} readOnly >{dto[key]}</Textarea>
                    <Flex margin="15px" ><CreateDropDownButton width="200px" name={"Edit..."} state={state} element={<></>}/></Flex>
                </>)
        },
        { key: "dataCommandPrefix", label: "Data command prefix", type: "string" },
    ]
    const [panels, setPanels] = React.useState([]);
    const [selectedPanel, setSelectedPanel] = React.useState(null);
    const panelsRef = React.useRef(panels);
    panelsRef.current = panels;
    React.useEffect(() => {
        WebHelper.get("addon/customPanels?gameid=" + gameDataRef.current?.Game?.id, (response) => { setPanels(response) }, (error) => console.log(error));
    }, []);

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Views List`);

    const AddCard = () => {
        let newPanel = { name: "New Panel", description: "", content: "[]", dataCommandPrefix: "" };
        WebSocketManagerInstance.Send({ command: "custom_panel_add", data: newPanel });
    }

    const HandleIncomingMessage = (data) => {
        if (data.command === "custom_panel_add") {
            setPanels([...panelsRef.current, data.data]);
        }
        else if (data.command === "custom_panel_update") {
            setPanels(panelsRef.current.map(x => x.id === data.data.id ? data.data : x));
        }
        else if (data.command === "custom_panel_delete") {
            setPanels(panelsRef.current.filter(x => x.id !== data.data));
            if (selectedPanel?.id === data.data)
                setSelectedPanel(null);
        }
    }

    return (
        <BasePanel>
            <Subscribable commandPrefix={"custom_panel"} onMessage={HandleIncomingMessage} />
            <Flex>
                <Stack width={300}>
                    <DList mainComponent={true} withAddButton handleAdd={AddCard} >
                        {panels?.map((x) =>
                            <DListItem isSelected={selectedPanel?.id === x.id} key={x.id} onClick={() => { setSelectedPanel(x) }}>
                                <DLabel>{x.name}</DLabel>
                                <DListItemsButtonContainer>
                                    <DListItemButton icon={FaMinus} color={'red'} onClick={() => WebSocketManagerInstance.Send({ command: "custom_panel_delete", data: x.id })} />
                                </DListItemsButtonContainer>
                            </DListItem>)}
                    </DList>
                </Stack>
                <Flex grow={1} height={'100%'}>
                    <DContainer width={'100%'} height={'100%'}>
                        {selectedPanel ?
                            <SettingsPanel editableKeyLabelDict={editableDict} dto={selectedPanel} onSave={(dto) => { WebSocketManagerInstance.Send({ command: "custom_panel_update", data: { ...selectedPanel, ...dto } }) }} />
                            : <></>}
                    </DContainer>
                </Flex>
            </Flex>
        </BasePanel>
    )
}
export default CustomViewsPanel;