import * as React from 'react';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import SettingsPanel from './SettingsPanel';
import ClientMediator from '../../../ClientMediator';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';
import { propertyNamesOf, readPropertyFields, splitPropertyValues } from '../../../helpers/propertyFields';

export const SettingsPanelWithPropertySettings = ({
    dto,
    editableKeyLabelDict,
    onSave,
    withExport,
    onValidation,
    entityName,
    hideSaveButton,
    saveOnLeave,
    showSearch,
}) => {
    const [properties, setProperties] = React.useState([]);
    const [mergedDto, setMergedDto] = React.useState(null);

    // Ref so propertySave always sees the latest loaded properties
    const propertiesRef = React.useRef(properties);
    propertiesRef.current = properties;

    React.useEffect(() => {
        WebHelper.get("properties/QueryProperties?parentIds=" + dto.id, (data) => {
            const names = propertyNamesOf(editableKeyLabelDict);
            setProperties(data.filter((x) => names.includes(x.name)));

            // Build a merged snapshot: dto fields + property values (never mutate the incoming dto)
            setMergedDto({ ...structuredClone(dto), ...readPropertyFields(editableKeyLabelDict, data) });
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dto.id]);

    const propertySave = async (dtoToUpdate) => {
        // Always reload properties before saving so we have accurate IDs.
        // Without this, property_add silently fails with AlreadyExists when the
        // property was created in a previous session and isn't in propertiesRef.
        const freshData = await WebHelper.getAsync("properties/QueryProperties?parentIds=" + mergedDto.id);
        if (freshData) {
            const names = propertyNamesOf(editableKeyLabelDict);
            const freshProps = freshData.filter((x) => names.includes(x.name));
            setProperties(freshProps);
            propertiesRef.current = freshProps;
        }

        // A field kept in several properties is written out into each of them.
        const { properties: propertyValues, rest: remaining } = splitPropertyValues(editableKeyLabelDict, dtoToUpdate);
        const propsToUpdate = [];

        Object.entries(propertyValues).forEach(([name, value]) => {
            const existingProp = propertiesRef.current.find((x) => x.name === name);
            if (existingProp) {
                propsToUpdate.push({ ...existingProp, value: value?.toString() ?? "" });
                return;
            }
            WebSocketManagerInstance.Send({
                command: "property_add",
                data: { name, value, parentId: mergedDto.id, EntityName: entityName },
            });
        });

        if (propsToUpdate.length > 0) {
            await ClientMediator.sendCommandAsync("properties", "UpdateBulk", { properties: propsToUpdate });
        }

        onSave?.(remaining);
    };

    if (!mergedDto) return null;

    return (
        <SettingsPanel
            showSearch={showSearch}
            dto={mergedDto}
            withExport={withExport}
            editableKeyLabelDict={editableKeyLabelDict}
            onSave={propertySave}
            onValidation={onValidation}
            hideSaveButton={hideSaveButton}
            saveOnLeave={saveOnLeave}
        />
    );
};

export default SettingsPanelWithPropertySettings;