import * as React from 'react';
import WebHelper from '../../../helpers/WebHelper';
import SettingsPanel from './SettingsPanel';
import WebSocketManagerInstance from '../WebSocketManager';
import ClientMediator from '../../../ClientMediator';

export const SettingsPanelWithPropertySettings = ({ dto, editableKeyLabelDict, onSave, withExport, onValidation, entityName, hideSaveButton, saveOnLeave, showSearch }) => {
    const [properties, setProperties] = React.useState([]);
    const [savedDto, setSavedDto] = React.useState(structuredClone(dto));
    const [show, setShow] = React.useState(false);

    React.useState(() => {
        WebHelper.get("properties/QueryProperties?parentIds=" + dto.id, (data) => {
            let propsEditable = editableKeyLabelDict.filter(x => x.property);
            let propsEditableKeys = propsEditable.map(x => x.key.toLowerCase());
            setProperties(data.filter(x => propsEditableKeys.includes(x.name.toLowerCase())));
            propsEditable.forEach(prop => {
                let propKey = prop.key.toLowerCase();
                if (!savedDto[propKey]) {

                    let value = data.find(x => x.name === propKey)?.value
                    if(prop.type === "number")
                    {
                        value = parseFloat(value);
                    }
                    if(prop.type === "boolean")
                    {
                        value = value === "true" || value === true || value === "True";
                    }

                    savedDto[prop.key] = value;
                }
            });
            setShow(true);
        });
    }, []);

    const propertySave = (dtoToUpdate) => {
        let propsToUpdate = [];
        Object.keys(dtoToUpdate).forEach(_key => {
            const key = _key.toLowerCase();

            let prop = properties.find(x => x.name.toLowerCase() === key);
            if (prop) {
                prop.value = dtoToUpdate[key].toString();
                propsToUpdate.push(prop);
                delete dtoToUpdate[key];
                return;
            }

            if (editableKeyLabelDict.find(x => x.key === key).property) {
                ClientMediator.sendCommandAsync("properties", "add", { name: key, value: dtoToUpdate[key], parentId: savedDto.id, EntityName: entityName })
                delete dtoToUpdate[key];
            }
        });

        if (propsToUpdate.length > 0) {
            ClientMediator.sendCommandAsync("properties", "UpdateBulk", { properties: propsToUpdate });
        }

        if (onSave)
            onSave(dtoToUpdate);
    };

    return (
        <>
            {show ? <SettingsPanel
                showSearch={showSearch}
                dto={savedDto}
                withExport={withExport}
                editableKeyLabelDict={editableKeyLabelDict}
                onSave={propertySave}
                onValidation={onValidation}
                hideSaveButton={hideSaveButton}
                saveOnLeave={saveOnLeave}
            /> : <></>}
        </>
    );
}

export default SettingsPanel; 