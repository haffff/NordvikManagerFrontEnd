import * as React from 'react';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import SettingsPanel from './SettingsPanel';
import ClientMediator from '../../../ClientMediator';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';

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
            const propsEditable = editableKeyLabelDict.filter((x) => x.property);
            const propsEditableKeys = propsEditable.map((x) => x.key);
            const relevantProps = data.filter((x) => propsEditableKeys.includes(x.name));

            setProperties(relevantProps);

            // Build a merged snapshot: dto fields + property values (never mutate the incoming dto)
            const propValues = {};
            propsEditable.forEach((prop) => {
                const found = data.find((x) => x.name === prop.key);
                let value = found?.value;
                if (prop.type === "number")  value = parseFloat(value);
                if (prop.type === "boolean") value = value === "true" || value === true || value === "True";
                propValues[prop.key] = value;
            });

            setMergedDto({ ...structuredClone(dto), ...propValues });
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dto.id]);

    const propertySave = async (dtoToUpdate) => {
        // Always reload properties before saving so we have accurate IDs.
        // Without this, property_add silently fails with AlreadyExists when the
        // property was created in a previous session and isn't in propertiesRef.
        const freshData = await WebHelper.getAsync("properties/QueryProperties?parentIds=" + mergedDto.id);
        if (freshData) {
            const propsEditable = editableKeyLabelDict.filter((x) => x.property);
            const propsEditableKeys = propsEditable.map((x) => x.key);
            const freshProps = freshData.filter((x) => propsEditableKeys.includes(x.name));
            setProperties(freshProps);
            propertiesRef.current = freshProps;
        }

        const remaining = { ...dtoToUpdate };
        const propsToUpdate = [];

        Object.keys(remaining).forEach((key) => {
            const existingProp = propertiesRef.current.find((x) => x.name === key);
            if (existingProp) {
                propsToUpdate.push({ ...existingProp, value: remaining[key]?.toString() ?? "" });
                delete remaining[key];
                return;
            }
            if (editableKeyLabelDict.find((x) => x.key === key)?.property) {
                WebSocketManagerInstance.Send({
                    command: "property_add",
                    data: { name: key, value: remaining[key], parentId: mergedDto.id, EntityName: entityName },
                });
                delete remaining[key];
            }
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