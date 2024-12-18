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
import { OnPropertyNotifyBehavior } from "./Server/Properties/OnPropertyNotifyBehavior";
import { OnTokenClickedInSelectModeClientBehavior } from "./Client/OnTokenClickedInSelectModeBehavior";
import { OnDragStartClientBehavior } from "./Client/Drag/OnDragStart";
import { OnDragEndClientBehavior } from "./Client/Drag/OnDragEnd";
import { OnDragMoveClientBehavior } from "./Client/Drag/OnDragMove";
import { OnClickContextMenuHandleClientBehavior } from "./Client/OnClickContextMenuHandle";
import { OnMouseWheelChangeZoomClientBehavior } from "./Client/OnMouseWheelChangeZoom";
import { OnObjectMoveHideTokenUIClientBehavior } from "./Client/OnObjectMoveHideTokenUI";
import { OnMouseMovePopupLocationUpdateClientBehavior } from "./Client/OnMouseMovePopupLocationUpdate";
import { OnMouseDownSimpleCreateClientBehavior } from "./Client/SimpleCreate/OnMouseDownSimpleCreate";
import { OnMouseUpSimpleCreateClientBehavior } from "./Client/SimpleCreate/OnMouseUpSimpleCreate";
import { OnMouseMoveSimpleCreateClientBehavior } from "./Client/SimpleCreate/OnMouseMoveSimpleCreate";
import { OnPathCreatedFreeDrawClientBehavior } from "./Client/Draw/OnPathCreatedFreeDraw";
import { OnMouseDownMeasureStartClientBehavior } from "./Client/Measure/OnMouseDownMeasureStart";
import { OnMouseUpMeasureEndsClientBehavior } from "./Client/Measure/OnMouseUpMeasureEnds";
import { OnMouseMoveMeasureUpdateClientBehavior } from "./Client/Measure/OnMouseMoveMeasureUpdate";

export const BehaviorDictionaryServer = {
  element_add: new OnAddElementBehavior(),
  element_update: new OnUpdateElementBehavior(),
  element_remove: new OnRemoveElementBehavior(),
  element_group: new OnGroupBehavior(),
  element_ungroup: new OnUngroupBehavior(),
  settings_map: new OnMapSettingsUpdateBehavior(),
  map_change: new OnMapChangeBehavior(),
  permissions_update: new OnPermissionsChangedBehavior(),
  property_add: new OnPropertyAddBehavior(),
  property_update: new OnPropertyUpdateBehavior(),
  property_remove: new OnPropertyDeleteBehavior(),
  property_notify: new OnPropertyNotifyBehavior(),

  //Previewing, for example ruler
  preview_start: new OnPreviewStartBehavior(),
  preview_update: new OnPreviewUpdateBehavior(),
  preview_end: new OnPreviewEndBehavior(),
};

export const BehaviorDictionaryClient = {
  "object:modified": [new OnNativeObjectModifiedClientBehavior()],
  "object:moving": [new OnObjectMoveHideTokenUIClientBehavior()],
  "selection:created": [new OnTokenSelectedClientBehavior()],
  "selection:updated": [new OnTokenSelectedClientBehavior()],
  "selection:cleared": [new OnTokenSelectedClientBehavior()],
  "mouse:down": [
    new OnDragStartClientBehavior(),
    new OnClickContextMenuHandleClientBehavior(),
    new OnMouseDownSimpleCreateClientBehavior(),
    new OnMouseDownMeasureStartClientBehavior(),
  ],
  "mouse:up": [
    new OnDragEndClientBehavior(),
    new OnTokenClickedInSelectModeClientBehavior(),
    new OnMouseUpSimpleCreateClientBehavior(),
    new OnMouseUpMeasureEndsClientBehavior(),
  ],
  "mouse:move": [
    new OnDragMoveClientBehavior(),
    new OnMouseMovePopupLocationUpdateClientBehavior(),
    new OnMouseMoveSimpleCreateClientBehavior(),
    new OnMouseMoveMeasureUpdateClientBehavior(),
  ],
  "mouse:wheel": [new OnMouseWheelChangeZoomClientBehavior()],
  "path:created": [
    new OnPathCreatedFreeDrawClientBehavior(),
  ],
};

export const UserActionDictionary = {};
