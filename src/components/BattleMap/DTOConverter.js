export const DTOConverter = {
    ConvertToDTO: (object) => {
        const dto = { object: JSON.stringify(object) };

        dto.id = object.id;
        dto.layer = object.layer;
        dto.MapID = object.mapID;
        dto.properties = [];
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

        let props = dto.properties || dto.Properties;
        if (props && props.length > 0) {

            let propObj = {};

            props.forEach(prop => {
                propObj[prop.name] = prop;
            });

            object.properties = propObj;
        }
        else
        {
            object.properties = {};
        }

        return object
    }
}

export default DTOConverter;