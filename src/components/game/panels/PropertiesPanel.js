import * as React from 'react';
import * as Dockable from "@hlorenzi/react-dockable"
import { Text } from '@chakra-ui/react';
import ElementSettingsPanel from '../settings/ElementsSettingsPanel';
import { BasePanel } from '../../uiComponents/base/BasePanel';
import ClientMediator from '../../../ClientMediator';
import useBMName from '../../uiComponents/hooks/useBattleMapName';

/**
 * Settings of the element selected when the panel was opened. It stays on that element:
 * selecting something else on the map doesn't change what is being edited — open
 * Properties again for that.
 */
export const PropertiesPanel = ({ battlemapId }) => {
    const [element, setElement] = React.useState(null);
    const bmName = useBMName(battlemapId);

    React.useEffect(() => {
        ClientMediator.sendCommandWaitForRegister("BattleMap", "GetSelectedObjects", { contextId: battlemapId }, true)
            .then((selected) => setElement(selected?.length === 1 ? selected[0] : null));
    }, []);

    const ctx = Dockable.useContentContext();
    ctx.setTitle(element ? `${bmName} - ${element.name} - Element Settings` : `${bmName} - Element Settings`);

    return (
        <BasePanel>
            {element
                ? <ElementSettingsPanel battlemapId={battlemapId} dto={element} />
                : <Text padding="10px">Select one element, then open Properties from its right-click menu.</Text>}
        </BasePanel>
    )
}
export default PropertiesPanel;
