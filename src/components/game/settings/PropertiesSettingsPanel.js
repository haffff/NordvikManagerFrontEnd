import * as React from 'react';
import CommandFactory from '../../BattleMap/Factories/CommandFactory';
import WebSocketManagerInstance from '../WebSocketManager';
import Subscribable from '../../uiComponents/base/Subscribable';
import WebHelper from '../../../helpers/WebHelper';
import { IoIosRemoveCircleOutline } from 'react-icons/io';
import DList from '../../uiComponents/base/List/DList';
import DListItemButton from '../../uiComponents/base/List/ListItemDetails/DListItemButton';
import DButtonHorizontalContainer from '../../uiComponents/base/Containers/DButtonHorizontalContainer';
import BasePanel from '../../uiComponents/base/BasePanel';
import DLabel from '../../uiComponents/base/Text/DLabel';
import { Flex, Input, Table, TableContainer, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import DropDownButton from '../../uiComponents/base/DDItems/DropDrownButton';
import { SearchInput } from '../../uiComponents/SearchInput';

export const PropertiesSettingsPanel = ({ gameId, dto, type, initProperties }) => {
    const [properties, setProperties] = React.useState(initProperties || []);
    const [originalProperties, setOriginalProperties] = React.useState(initProperties || []);
    const [search, setSearch] = React.useState("");
    const [startIndex, setStartIndex] = React.useState(0); // New state variable
    const propsRef = React.useRef([]);
    propsRef.current = properties;

    React.useEffect(() => {
        if (!initProperties || initProperties.length == 0) {
            WebHelper.get("properties/QueryProperties?parentIds=" + dto.id, (response) => { setProperties([...response]); setOriginalProperties([...response]); }, (error) => console.log(error));
        }
    }, []);

    const HandleNameChange = (event, p) => {
        let index = properties.indexOf(p);
        let newProps = [...properties];
        newProps[index].name = event.target.value;
        newProps[index].toEdit = true;
        setProperties(newProps);
    }

    const HandleValueChange = (event, p) => {
        let index = properties.indexOf(p);
        let newProps = [...properties];
        newProps[index].value = event.target.value;
        newProps[index].toEdit = true;
        setProperties(newProps);
    }

    const preparePanel = (property, index) => {
        if (index < startIndex || index >= startIndex + 50) {
            return null; // Skip rendering if index is not within the range
        }

        let color = undefined;
        color = property.toEdit ? '#515151' : color;
        color = property.toDel ? 'darkred' : color;
        color = property.toAdd ? 'darkgreen' : color;

        return (
            <Table.Row key={property.id}>
                <Table.Cell>
                    <Input size='xs' backgroundColor={color} fontWeight={'bold'} value={property.name} onChange={(e) => HandleNameChange(e, property)} />
                </Table.Cell>
                <Table.Cell>
                    <Input size='xs' backgroundColor={color} value={property.value} onChange={(e) => HandleValueChange(e, property)} />
                </Table.Cell>
                <Table.Cell>
                    <DListItemButton label={'Remove'} color={'red'} icon={IoIosRemoveCircleOutline} onClick={() => HandleDelete(property)} />
                </Table.Cell>
            </Table.Row>
        );
    }

    const HandleDelete = (property) => {
        let newProps = [...properties];

        let index = newProps.indexOf(property);

        if (property.toAdd) {
            newProps.splice(index, 1);
        } else {
            if (!property.toDel) {
                newProps[index].toDel = true;
            } else {
                newProps[index].toDel = undefined;
            }
        }
        setProperties(newProps);
    }

    const HandleEdit = () => {
        const copyProps = [...properties];
        setProperties([...originalProperties]);
        copyProps.forEach(x => {
            if (x.toDel) {
                x.toDel = undefined;
                x.toEdit = undefined;
                let cmd = CommandFactory.CreatePropertyRemoveCommand(x.id);
                WebSocketManagerInstance.Send(cmd);
            } else if (x.toAdd) {
                x.toAdd = undefined;
                x.toEdit = undefined;
                let cmd = CommandFactory.CreatePropertyAddCommand(x);
                WebSocketManagerInstance.Send(cmd);
            } else if (x.toEdit) {
                x.toEdit = undefined;
                let cmd = CommandFactory.CreatePropertyUpdateCommand(x);
                WebSocketManagerInstance.Send(cmd);
            }
        });
    }

    const HandleAdd = () => {
        setProperties([...properties, { name: "New_Property", value: "", EntityName: type, parentId: dto.id, toAdd: true }]);
    }

    const handleMessage = (event) => {
        let newProps = [...propsRef.current];
        if (event.command === "property_update") {
            let index = newProps.findIndex(x => x.id === event.data.id);
            newProps[index] = event.data;
        }
        if (event.command === "property_add" && event.data.parentId === dto.id) {
            newProps.push(event.data);
        }
        if (event.command === "property_remove") {
            let index = newProps.findIndex(x => x.id === event.data);
            newProps.splice(index, 1);
        }
        setProperties(newProps);
        setOriginalProperties(newProps);
    }

    const handleScroll = (event) => {
        const { scrollTop, scrollHeight, clientHeight } = event.target;

        if (scrollTop === 0) {
            if (startIndex > 1) {
                setStartIndex(startIndex - 25); // Load previous 25 positions
                event.target.scrollTop = 1; // Scroll to 1 to prevent scroll jump
            }
        }

        if (scrollTop + clientHeight === scrollHeight) {
            setStartIndex(startIndex + 25); // Load next 25 positions
        }
    };

    return (
        <BasePanel>
            <Flex margin={'5px'}>
                <SearchInput value={search} onChange={(v) => setSearch(v)} />
            </Flex>
                <Table.Root size={'xs'} variant='simple'>
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeader>Name</Table.ColumnHeader>
                            <Table.ColumnHeader>Value</Table.ColumnHeader>
                            <Table.ColumnHeader>Actions</Table.ColumnHeader>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {properties.filter(x => x.name.includes(search)).map((x, index) => preparePanel(x, index))}
                    </Table.Body>
                </Table.Root>

            <DList withAddButton={true} handleAdd={HandleAdd}></DList>
            <DButtonHorizontalContainer>
                <DropDownButton width={200} name={"Save"} onClick={() => HandleEdit()} />
                <DropDownButton width={200} name={"Reset"} onClick={() => setProperties(structuredClone(originalProperties))} />
            </DButtonHorizontalContainer>
            <Subscribable commandPrefix={"property"} onMessage={handleMessage} />
        </BasePanel>
    );
}
export default PropertiesSettingsPanel;
