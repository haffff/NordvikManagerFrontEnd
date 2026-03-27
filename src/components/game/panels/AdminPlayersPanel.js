import * as React from "react";
import PlayersPanel from "./PlayersPanel";

// AdminPlayersPanel — kept for backward-compat with PanelsList / ViewsMenu.
// The actual implementation lives in PlayersPanel with adminMode=true.
export const AdminPlayersPanel = ({ state }) => (
  <PlayersPanel state={state} adminMode={true} />
);

export default AdminPlayersPanel;
