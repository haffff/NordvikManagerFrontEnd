import * as React from 'react';
import { Flex, Circle, FormLabel, HStack, Input, Select, Checkbox, Stack, Card, CardBody } from '@chakra-ui/react'
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
import CollectionSyncer from '../../../uiComponents/base/CollectionSyncer';
import { SettingsPanelWithPropertySettings } from '../../settings/SettingsPanelWithPropertySettings';

export const TemplatesPanel = ({ gameDataRef }) => {
    const editableDict = [
        { key: "name", label: "UI Name", type: "string" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "mainResource", label: "Main Resource (Javascript)", type: "materialSelect", additionalFilter: (item) => item.mimeType == "text/javascript" },
        { key: "additionalResources", label: "Additional Resources", type: "materialSelect", multiple: true },
        { key: "token", property:true ,label: "Default Token", type: "materialSelect", additionalFilter: (item) => item.mimeType == "application/json" },
        { key: "drop_token_size", property:true ,label: "Default Token Size", type: "number" },
    ]
    const [panels, setPanels] = React.useState([]);
    const [selectedPanel, setSelectedPanel] = React.useState(null);
    const panelsRef = React.useRef(panels);
    panelsRef.current = panels;

    React.useEffect(() => {
        WebHelper.get("materials/GetTemplatesFull?gameid=" + gameDataRef.current?.Game?.id, (response) => { 
            setPanels(response);
        }, (error) => console.log(error));
    }, []);

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Templates List`);

    const AddCard = () => {
        let newPanel = { name: "New Template", description: "", content: "", dataCommandPrefix: "" };
        WebSocketManagerInstance.Send({ command: "template_add", data: newPanel });
    }

    return (
        <BasePanel>
            <CollectionSyncer collection={panels} setCollection={setPanels} commandPrefix={"template"} />
            <Flex>
                <Stack width={300}>
                    <DList mainComponent={true} withAddButton handleAdd={AddCard} >
                        {panelsRef.current?.map((x) =>
                            <DListItem isSelected={selectedPanel?.id === x.id} key={x.id} onClick={() => { setSelectedPanel(x) }}>
                                <DLabel>{x.name}</DLabel>
                                <DListItemsButtonContainer>
                                    <DListItemButton icon={FaMinus} color={'red'} onClick={() => WebSocketManagerInstance.Send({command: "template_delete", data: x.id})}/>
                                </DListItemsButtonContainer>
                            </DListItem>)}
                    </DList>
                </Stack>
                <Flex grow={1} height={'100%'}>
                    <DContainer width={'100%'} height={'100%'}>
                        {selectedPanel ?
                            <SettingsPanelWithPropertySettings withExport key={selectedPanel.id} entityName={"CardModel"} gameDataManagerRef={gameDataRef} editableKeyLabelDict={editableDict} dto={selectedPanel} onSave={(dto) => { 
                                WebSocketManagerInstance.Send({ command: "template_update", data: {...selectedPanel, ...dto} }) 
                            }} />
                            : <></>}
                    </DContainer>
                </Flex>
            </Flex>
        </BasePanel>
    )
}
export default TemplatesPanel;