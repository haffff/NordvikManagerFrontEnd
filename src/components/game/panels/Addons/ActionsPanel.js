import * as React from 'react';
import { Flex, FormLabel, HStack, Input, Select, Checkbox, Stack } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import Subscribable from '../../../uiComponents/base/Subscribable';
import DList from '../../../uiComponents/base/List/DList';
import WebSocketManagerInstance from '../../WebSocketManager';
import WebHelper from '../../../../helpers/WebHelper';
import DContainer from '../../../uiComponents/base/Containers/DContainer';
import DListItem from '../../../uiComponents/base/List/DListItem';
import DLabel from '../../../uiComponents/base/Text/DLabel';
import ActionConstants from './ActionConstants';
import EditTable from '../../settings/EditTable';
import { FaArrowAltCircleDown, FaArrowAltCircleUp, FaMinusCircle } from 'react-icons/fa';
import DListItemButton from '../../../uiComponents/base/List/ListItemDetails/DListItemButton';
import DropDownButton from '../../../uiComponents/base/DDItems/DropDrownButton';

export const ActionsPanel = ({ state, gameDataRef }) => {
    const [actions, setActions] = React.useState([]);
    const [selectedAction, setSelectedAction] = React.useState(null);
    const [steps, setSteps] = React.useState([]);
    const [search, setSearch] = React.useState("");
    const forceUpdate = React.useReducer(x => x + 1, 0)[1];

    React.useEffect(() => {
        WebHelper.get("addon/actions?gameid=" + gameDataRef.current?.Game?.id, (response) => { setActions(response) }, (error) => console.log(error));
    }, []);

    const HandleIncomingMessage = (response) => {
        if (response.command === "action_add") {
            WebHelper.get("addon/actions?gameid=" + gameDataRef.current?.Game?.id, (response) => { setActions(response) }, (error) => console.log(error));
        }
        if (response.command === "action_update") {
            let index = actions.findIndex(x => x.id === response.data.id);
            if (index !== -1) {
                actions[index] = response.data;
                setActions([...actions]);
            }
        }
        if (response.command === "action_delete") {
            let index = actions.findIndex(x => x.id === response.data);
            if (index !== -1) {
                actions.splice(index, 1);
                setActions([...actions]);
                if(selectedAction.id === response.data) {
                    setSelectedAction(null);
                    setSteps([]);
                }
            }
        }
    }

    const selectItem = (e) => {
        WebHelper.get("addon/action?gameid=" + gameDataRef.current?.Game?.id + "&id=" + e.id, (response) => { setSelectedAction(response); setSteps(JSON.parse(response.content)) }, (error) => console.log(error));
    }

    const GenerateStep = (step) => {
        return ActionConstants.StepDefinitions[step.Type] !== undefined ?
            <EditTable keyBase={selectedAction.name} dto={step.Data} editableKeyLabelDict={ActionConstants.StepDefinitions[step.Type]} hideSaveButton={true} saveOnLeave={true} onSave={(dto) => {
                let newSteps = [...steps]; newSteps[steps.indexOf(step)] = { ...step, Data: { ...step.Data, ...dto } }; setSteps(newSteps);
            }} /> : <DLabel>Invalid Step Type</DLabel>
    }

    const HandleStep = (step) => {
        const def = ActionConstants.StepDefinitions[step.Type];

        if (!def) {
            return <DLabel>Invalid Step Type</DLabel>;
        }

        console.log(step.Label)
        return (
            <DContainer withVisibilityToggle={true} title={step?.Data?.Label} backgroundColor="rgb(50,50,50)" collapsed>
                <Stack>
                    <HStack>
                        <DListItemButton label={"Move Up"} icon={FaArrowAltCircleUp} onClick={() => {
                            let newSteps = [...steps];
                            let index = newSteps.indexOf(step);
                            if (index > 0) {
                                [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
                            }
                            setSteps(newSteps);
                        }} />
                        <DListItemButton label={"Move Down"} icon={FaArrowAltCircleDown} onClick={() => {
                            let newSteps = [...steps];
                            let index = newSteps.indexOf(step);
                            if (index < newSteps.length - 1) {
                                [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
                            }
                            setSteps(newSteps);
                        }} />
                        <DListItemButton label={"Delete"} icon={FaMinusCircle} color={'red'} onClick={() => {
                            let newSteps = [...steps];
                            newSteps.splice(steps.indexOf(step), 1);
                            setSteps(newSteps);
                        }} />
                    </HStack>
                    <Select value={step.Type} onChange={(e) => {
                        let newSteps = [...steps];
                        newSteps[steps.indexOf(step)] = { ...step, Type: e.target.value };
                        setSteps(newSteps);
                        forceUpdate();
                    }}>
                        {Object.keys(ActionConstants.StepTypes).map((x) => <option value={x}>{ActionConstants.StepTypes[x]}</option>)}
                    </Select>
                    <DContainer title={"Data"} withVisibilityToggle={true}>
                        {GenerateStep(step)}
                    </DContainer>
                </Stack>
            </DContainer>
        )
    }

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Actions`);

    return (
        <>
            <Subscribable onMessage={HandleIncomingMessage} commandPrefix={"action"} />
            <Flex overflowY={'auto'} height={'100%'}>
                <DContainer width={'300px'} maxWidth={'700px'}>
                    <DList mainComponent={true} withAddButton handleAdd={() => { WebSocketManagerInstance.Send({ command: "action_add", data: { Prefix: "MyPrefix", Name: "Name", Hook: 0, Content: "[]" } }) }}>
                        <FormLabel>Actions</FormLabel>
                        <Input placeholder={"Search"} onChange={(e) => setSearch(e.target.value)} />
                        {actions.filter(x => x.name.toLowerCase().includes(search.toLowerCase())).map(x => (<DListItem isSelected={selectedAction?.id == x?.id} onClick={() => { selectItem(x) }}><DLabel>{x.name}</DLabel></DListItem>))}
                    </DList>
                </DContainer>
                {selectedAction ?

                <Stack key={selectedAction?.id} padding={'10px'} width={'100%'}>
                    <FormLabel>Action</FormLabel>
                    <Flex>
                        <Checkbox isChecked={selectedAction?.isEnabled} onChange={(e) => { setSelectedAction({ ...selectedAction, isEnabled: e.target.checked }) }}>Enabled</Checkbox>
                    </Flex>
                    <Flex>
                        <Input width={'200px'} value={selectedAction?.prefix} onChange={(e) => { setSelectedAction({ ...selectedAction, prefix: e.target.value }) }} />
                        <Input value={selectedAction?.name} onChange={(e) => { setSelectedAction({ ...selectedAction, name: e.target.value }) }} />
                    </Flex>
                    <Input value={selectedAction?.description} onChange={(e) => { setSelectedAction({ ...selectedAction, description: e.target.value }) }} />
                    <Select defaultValue={-1} value={selectedAction?.hook} onChange={(e) => { setSelectedAction({ ...selectedAction, hook: e.target.value }) }}>
                        {ActionConstants.Hooks.map((x, i) => <option value={i}>{x}</option>)}
                    </Select>
                    <DContainer title={"Steps"} withVisibilityToggle={true}>
                        <DList mainComponent={true} withAddButton handleAdd={() => setSteps([...steps, { Data: { Label: "Step" }, Type: "SetVariable" }])}>
                            {steps?.map((x) => HandleStep(x)) || []}
                        </DList>
                    </DContainer>
                    <Flex padding={'5px'}>
                        <DropDownButton name={"Update"} height={"50px"} width="300px" onClick={() => {
                            selectedAction.content = JSON.stringify(steps);
                            WebSocketManagerInstance.Send({ command: "action_update", data: selectedAction });
                        }} />
                        <DropDownButton name={"Delete"} height={"50px"} width="300px" onClick={() => {
                            selectedAction.content = JSON.stringify(steps);
                            WebSocketManagerInstance.Send({ command: "action_delete", data: selectedAction.id });
                        }} />
                    </Flex>
                </Stack> : <></> }
            </Flex>
        </>
    )
}
export default ActionsPanel;