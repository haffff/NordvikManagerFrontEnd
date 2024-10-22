import { OnAddElementBehavior } from "./Server/OnAddElementBehavior";
import { OnUpdateElementBehavior } from "./Server/OnUpdateElementBehavior";
import { OnNativeObjectModifiedClientBehavior } from "./Client/OnNativeObjectModifiedClientBehavior";
import { OnTokenSelectedClientBehavior } from "./Client/OnTokenSelectedBehavior";
import { OnRemoveElementBehavior } from "./Server/OnRemoveElementBehavior";
import { OnGroupBehavior } from "./Server/OnGroupBehavior";
import { OnUngroupBehavior } from "./Server/OnUngroupBehavior";
import { OnMapSettingsUpdateBehavior } from "./Server/OnMapSettingsUpdateBehavior";
import { OnMapChangeBehavior } from "./Server/OnMapChange";
import { OnPermissionsChangedBehavior } from "./Server/OnPermissionsChangedBehavior";
import { OnPreviewStartBehavior } from "./Server/Preview/OnPreviewStart";
import { OnPreviewUpdateBehavior } from "./Server/Preview/OnPreviewUpdate";
import { OnPreviewEndBehavior } from "./Server/Preview/OnPreviewEnd";
import { OnPropertyAddBehavior } from "./Server/Properties/OnPropertyAddBehavior";
import { OnPropertyUpdateBehavior } from "./Server/Properties/OnPropertyUpdateBehavior";
import { OnPropertyDeleteBehavior } from "./Server/Properties/OnPropertyDeleteBehavior";

export const BehaviorDictionaryServer = {
    "element_add": new OnAddElementBehavior(),
    "element_update": new OnUpdateElementBehavior(),
    "element_remove": new OnRemoveElementBehavior(),
    "element_group": new OnGroupBehavior(),
    "element_ungroup": new OnUngroupBehavior(),
    "settings_map": new OnMapSettingsUpdateBehavior(),
    "map_change": new OnMapChangeBehavior(),
    "permissions_update": new OnPermissionsChangedBehavior(),
    "property_add": new OnPropertyAddBehavior(),
    "property_update": new OnPropertyUpdateBehavior(),
    "property_remove": new OnPropertyDeleteBehavior(),

    //Previewing, for example ruler
    "preview_start": new OnPreviewStartBehavior(),
    "preview_update": new OnPreviewUpdateBehavior(),
    "preview_end": new OnPreviewEndBehavior(),
}

export const BehaviorDictionaryClient = {
    "object:modified": new OnNativeObjectModifiedClientBehavior(),
    "selection:created": new OnTokenSelectedClientBehavior(),
    "selection:updated": new OnTokenSelectedClientBehavior(),
    "selection:cleared": new OnTokenSelectedClientBehavior(),
}

export const UserActionDictionary = {
    
}