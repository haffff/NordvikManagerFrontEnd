import * as React from "react";
import ClientMediator from "../../ClientMediator";
import LayoutHelper from "../../helpers/LayoutCloneHelper";
import LayoutPersistence from "../../helpers/LayoutPersistence";

const DEBOUNCE_MS = 4000;

/**
 * Always-mounted (Game.js). When the GM has enabled the per-game "saveLayoutOnExit"
 * toggle, this persists the current dockable arrangement to localStorage — debounced
 * on every change and synchronously on tab close — so useGameInitialization can
 * restore it on the player's next join instead of the game's default layout.
 *
 * Renders nothing; does nothing at all when the toggle is off.
 */
export const LayoutAutoSaveManager = ({ state, battlemapsRef }) => {
  const [cfg, setCfg] = React.useState(null); // { enabled, gameId, playerId }

  // Game data loads async (getfullgame). Read it at mount and again once
  // "BattleMapsChanged" fires (emitted right after loadGame populates gameRef).
  React.useEffect(() => {
    const loadCfg = () => {
      let game, player;
      try {
        // Can throw if the "Game" client isn't fully registered yet (only one
        // sibling client and it lacks the method) — the retry below covers it.
        game = ClientMediator.sendCommand("Game", "GetGame");
        player = ClientMediator.sendCommand("Game", "GetCurrentPlayer");
      } catch {
        return;
      }
      if (game?.id && player?.id) {
        setCfg({ enabled: !!game.saveLayoutOnExit, gameId: game.id, playerId: player.id });
      }
    };
    loadCfg();
    const handle = ClientMediator.on("BattleMapsChanged", loadCfg);
    return () => ClientMediator.off(handle);
  }, []);

  const enabled = !!cfg?.enabled;
  const timerRef = React.useRef(null);

  const flushNow = React.useCallback(() => {
    if (!enabled) return;
    const clone = LayoutHelper.GetCloneForSavingSafe(
      state?.ref?.current?.rootPanel,
      battlemapsRef
    );
    if (clone) LayoutPersistence.save(cfg.gameId, cfg.playerId, clone);
  }, [enabled, cfg, state, battlemapsRef]);

  // Debounced save on every dockable change (updateToken bumps on commit()).
  React.useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushNow, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, state?.updateToken, flushNow]);

  // Synchronous save on tab close — no await / fetch on this path.
  React.useEffect(() => {
    if (!enabled) return;
    const handler = () => flushNow();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled, flushNow]);

  return null;
};

export default LayoutAutoSaveManager;
