import WebHelper from "../../helpers/WebHelper";

export const DTOConverter = {

    ConvertToDTOMinified: (object, objectFieldsToInclude, includeProperties = false) => {

        const minifiedObject = {};

        objectFieldsToInclude.forEach(field => {
            minifiedObject[field] = object[field];
        });

        const dto = { object: JSON.stringify(minifiedObject) };

        dto.id = object.id;
        dto.layer = object.layer;
        dto.mapId = object.mapId;
        dto.properties = includeProperties ? object?.properties : undefined;

        return dto;
    },

    ConvertToDTO: (object) => {
        object.properties = undefined;
        object.src = undefined;
        const dto = { object: JSON.stringify(object) };

        dto.id = object.id;
        dto.layer = object.layer;
        dto.mapId = object.mapId;
        dto.properties = object?.properties;
        //dto.selectable = object.selectablePermission && dto.layer == selectedLayer; //not sure it should be here

        return dto;
    },
    ConvertFromDTO: (dto) => {
        if (typeof dto.object === "string") {
            dto.object = JSON.parse(dto.object);
        }
        const object = dto.object;

        object.id = dto.id;
        object.permission = dto.permission;
        object.selectablePermission = (dto.permission & 4) === 4;
        object.layer = dto.layer;
        object.src = WebHelper.getResourceString(object.resourceId, object.resourceKey);
        
        return object
    }
}

export default DTOConverter;