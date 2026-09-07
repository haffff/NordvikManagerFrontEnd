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
        // Mirrors ConvertToDTO below — without this, a drag/scale/rotate update
        // (which goes through this minified path) would round-trip through
        // ConvertFromDTO with insideLayerIndex reset to undefined, silently
        // clearing a bring-forward/send-backward position on every ordinary move.
        dto.insideLayerIndex = object.insideLayerIndex;
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
        // Bring-Forward/Send-Backward position. Like `layer` above, this rides as its
        // own top-level DTO field rather than inside the JSON.stringify(object) blob
        // (neither is in the fabric toObject() whitelist) — without this, the value
        // was silently dropped from every outgoing update, so bring-forward/send-
        // backward never synced to other clients and never survived a reload.
        dto.insideLayerIndex = object.insideLayerIndex;
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
        object.insideLayerIndex = dto.insideLayerIndex;
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