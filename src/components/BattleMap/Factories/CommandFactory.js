
export const CommandFactory = {
    CreateBattleMapUpdateCommand: (element, battleMapId, action) => {
        return { command: "element_update", battleMapId: battleMapId, data: element, action: action };
    },
    CreateUpdateCommand: (element,action) => {
        return { command: "element_update", data: element, action:action };
    },
    CreateAddCommand: (element, withSelection) => {
        return { command: "element_add", data: element, withSelection: withSelection };
    },
    CreateDeleteCommand: (element) => {
        return { command: "element_remove", data: element };
    },
    CreateGroupCommand: (groupElement, elementIds) => {
        return { command: "element_group", elementIds: elementIds, data: groupElement };
    },
    CreateUngroupCommand: (id, elements) => {
        return { command: "element_ungroup", data: elements, elementIds: [id] } ;
    },
    CreateChatSendCommand: (message) => {
        return { command: "chat_push", data: message };
    },
    CreateMapSettingsCommand: (dto) => {
        return { command: "settings_map", data: dto };
    },
    CreateGameSettingsCommand: (dto) => {
        return { command: "settings_game", data: dto };
    },
    CreatePlayerSettingsCommand: (dto) => {
        return { command: "settings_player", data: dto };
    },
    CreateChangeMapCommand: (mapId, battleMapId) => {
        return { command: "map_change", data: { mapId, id: battleMapId } };
    },
    CreateMapRemoveCommand: (mapId) => {
        return { command: "map_remove", data: mapId };
    },
    CreateMapAddCommand: () => {
        return { command: "map_add", data: {} };
    },
    CreateLayoutAddCommand: (layout) => {
        return { command: "layout_add", data: layout };
    },
    CreateLayoutUpdateCommand: (layout) => {
        return { command: "layout_update", data: layout };
    },
    CreateLayoutRemoveCommand: (id) => {
        return { command: "layout_remove", data: id };
    },
    CreateLayoutForceCommand: (id) => {
        return { command: "layout_forcechange", data: id };
    },
    CreateUpdatePermissionsCommand: (id, dtoType, permissions) => {
        return { command: "permissions_update", data: { id, entityType: dtoType, permissions } }
    },
    CreateDeleteBattleMap: (id) => {
        return { command: "battlemap_remove", data: id }
    },
    RenameBattleMap: (id, name) => {
        return { command: "battlemap_rename", data: { id, name } }
    },
    CreatePreviewStartCommand: (obj, battleMapId) => {
        return { command: "preview_start", data: obj, battleMapId }
    },
    CreatePreviewUpdateCommand: (obj, battleMapId) => {
        return { command: "preview_update", data: obj, battleMapId }
    },
    CreatePreviewEndCommand: (id) => {
        return { command: "preview_end", data: { id } }
    },
    CreateKickPlayerCommand: (id) => {
        return { command: "player_kick", data: id }
    },
    CreateShowBattleMapCommand: (battleMapContext) => {
        return { command: "battlemap_show", data: battleMapContext.Id }
    },
    CreatePropertyRemoveCommand: (id) => {
        return { command: "property_remove", data: id }
    },
    CreatePropertyUpdateCommand: (dto) => {
        return { command: "property_update", data:  dto  }
    },
    CreatePropertyAddCommand: (dto) => {
        return { command: "property_add", data:  dto  }
    },
}

export default CommandFactory;