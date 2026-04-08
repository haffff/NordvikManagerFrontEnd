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

            setProperties(relevantProps);            // Build a merged snapshot: dto fields + property values (never mutate the incoming dto)
            const propValues = {};
            propsEditable.forEach((prop) => {
                // Only fall back to the server-side property if the dto doesn't already carry this key
                // (use hasOwnProperty so that false/0/null-valued DTO fields are still respected)
                if (Object.prototype.hasOwnProperty.call(dto, prop.key)) return;

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

    const propertySave = (dtoToUpdate) => {
        const remaining = { ...dtoToUpdate };
        const propsToUpdate = [];

        Object.keys(remaining).forEach((key) => {
            const existingProp = propertiesRef.current.find((x) => x.name === key);
            if (existingProp) {
                propsToUpdate.push({ ...existingProp, value: remaining[key].toString() });
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
            ClientMediator.sendCommandAsync("properties", "UpdateBulk", { properties: propsToUpdate });
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