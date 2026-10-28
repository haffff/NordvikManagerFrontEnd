import * as React from "react";
import CollectionSyncer from "../../../uiComponents/base/CollectionSyncer";

/**
 * Keeps a list of maps in sync with the server: map_add / map_remove, and settings_map
 * (rename, grid, size). settings_map echoes only the fields that changed, so it is merged.
 */
export const MapsSyncer = ({ maps, setMaps }) => (
  <>
    <CollectionSyncer collection={maps} setCollection={setMaps} commandPrefix="map" />
    <CollectionSyncer collection={maps} setCollection={setMaps} commandPrefix="settings_map" updateCommand="settings_map" incrementalUpdate />
  </>
);

export default MapsSyncer;
