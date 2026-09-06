import { ActiveWebHelper as WebHelper } from "../../helpers/transport";
import { canControl } from "./Helpers/permissionBits";
import { SYSTEM_ASSET_KEYS } from "../../helpers/systemAssets";

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

        return dto;
    },
    ConvertFromDTO: (dto) => {
        if (typeof dto.object === "string") {
            dto.object = JSON.parse(dto.object);
        }
        const object = dto.object;

        object.id = dto.id;
        object.permission = dto.permission;
        object.selectablePermission = canControl(dto.permission);
        object.layer = dto.layer;
        if (object.resourceId || object.resourceKey) {
            object.src = WebHelper.getResourceString(object.resourceId, object.resourceKey);
        } else if (object.isToken) {
            // Token with no image assigned yet — resolve src to the placeholder key
            // without writing it onto resourceId/resourceKey, so this stays a
            // display-only fallback and never gets persisted as a real assignment
            // on the next save (ConvertToDTO only strips `src`, not resourceKey).
            object.src = WebHelper.getResourceString(null, SYSTEM_ASSET_KEYS.EMPTY_TOKEN_IMAGE);
        }

        return object
    }
}

export default DTOConverter;