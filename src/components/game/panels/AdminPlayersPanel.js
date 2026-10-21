import * as React from "react";
import PlayersPanel from "./PlayersPanel";

// AdminPlayersPanel — kept for backward-compat with PanelsList / ViewsMenu. The actual
// implementation lives in PlayersPanel, which shows the management buttons to whoever
// may edit the game.
export const AdminPlayersPanel = ({ state }) => (
  <PlayersPanel state={state} />
);

export default AdminPlayersPanel;
