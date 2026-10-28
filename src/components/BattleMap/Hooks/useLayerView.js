import * as React from "react";
import ClientMediator from "../../../ClientMediator";
import { useCustomLayers } from "../../uiComponents/hooks/useCustomLayers";
import { installLayerTargeting, setLayerView } from "../Helpers/LayerTargeting";
import { layerView } from "../Helpers/layerVisibility";

/**
 * Keeps a battle map canvas's layer view (hidden and GM-only custom layers) in step
 * with the game's layer list, live — the list follows property updates.
 */
export function useLayerView(canvas) {
  const gameId = React.useMemo(() => ClientMediator.sendCommand("Game", "GetGameId"), []);
  const { layers } = useCustomLayers(gameId);
  // "GM only" layers are for whoever may edit the game, not only its owner.
  const canEditGame = !!ClientMediator.sendCommand("Game", "GetCanEditGame");

  React.useEffect(() => {
    if (!canvas) return;
    installLayerTargeting(canvas);
    setLayerView(canvas, layerView(layers, canEditGame));
  }, [canvas, layers, canEditGame]);
}

export default useLayerView;
