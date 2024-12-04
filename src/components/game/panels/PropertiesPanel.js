import * as React from 'react';
import { HStack, Button, Box, Flex, Card, CardHeader, CardBody, Heading, Center, Badge, Checkbox, RadioGroup, Radio, useRadio, useRadioGroup, Stack, Switch, GridItem, Grid, Icon, IconButton } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import Loadable from '../../uiComponents/base/Loadable';
import Subscribable from '../../uiComponents/base/Subscribable';
import UtilityHelper from '../../../helpers/UtilityHelper';
import ElementSettingsPanel from '../settings/ElementsSettingsPanel';
import BasePanel from '../../uiComponents/base/BasePanel';
import ClientMediator from '../../../ClientMediator';
import useBMName from '../../uiComponents/hooks/useBattleMapName';

export const PropertiesPanel = ({ battlemapId, lockedObject, customTitle }) => {
    const [selectedObjects, setSelectedObjects] = React.useState(lockedObject ? [lockedObject] : []);
    const [uuid, _setUUID] = React.useState(UtilityHelper.GenerateUUID());
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const bmName = useBMName(battlemapId);
    const HandleSelection = (e) => {

        if (lockedObject) {
            return;
        }

        let selected = [];
        if (e.selected) {
            e.selected.forEach(item => selected.push(item));
        }

        if (e.deselected) {
            selected = selected.filter(x => !e.deselected.includes(x));
        }

        setSelectedObjects(selected);
    }

    React.useEffect(() => {
        ClientMediator.sendCommandWaitForRegister("BattleMap", "SubscribeSelectionChanged", { contextId: battlemapId, name:uuid, method:HandleSelection }, true);
        ClientMediator.sendCommandWaitForRegister("BattleMap", "GetSelectedObjects", { contextId: battlemapId }, true).then((r) => { setSelectedObjects(r) });

        return () => {
            ClientMediator.sendCommand("BattleMap", "UnSubscribeSelectionChanged", { name:uuid });
        }

    }, []);

    const ctx = Dockable.useContentContext();
    if (lockedObject) {
        ctx.setTitle(`Element Settings - ` + (lockedObject.name));
    }
    else {
        ctx.setTitle(bmName + ` - Element Settings`);
    }

    return (
        <BasePanel>
            {selectedObjects.length === 1 ? (<ElementSettingsPanel battlemapId={battlemapId} dto={selectedObjects[0]} />) : <></>}
        </BasePanel>
    )
}
export default PropertiesPanel;