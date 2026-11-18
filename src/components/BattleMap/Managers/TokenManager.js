import ClientMediator from "../../../ClientMediator";
import { installFeatures } from "./installFeatures";
import { tokenUiActions } from "./token/tokenUiActions";
import { tokenMasks } from "./token/tokenMasks";
import { tokenProperties } from "./token/tokenProperties";
import { tokenLoading } from "./token/tokenLoading";
import { tokenCreation } from "./token/tokenCreation";
import { tokenLayout } from "./token/tokenLayout";

class TokenManager {
  constructor({ getCanvas, battleMapModel } = {}) {
    this._getCanvas = getCanvas;
    this._battleMapModel = battleMapModel;
    this.panel = "battlemap_token";
    this.contextId = battleMapModel?.id;
    this.id = "TokenManager" + battleMapModel?.id;
  }

  // ── Canvas helpers ────────────────────────────────────────────────────────

  /** Find a single canvas object by id, or `undefined`. */
  _findObject(id) {
    return this._getCanvas()
      .getObjects()
      .find((o) => o.id === id);
  }

  /** Return all canvas objects that are tokens. */
  _allTokens() {
    // Bug fix: a token's own UI sub-elements (label, icons, ...) also carry a
    // small tokenData object of their own (anchor/propDeps, no cardId — see
    // CanvasObjectLoadToken/token_character.json) and were being matched here
    // too, alongside their actual parent token. UpdateTokensPropertySpecific's
    // per-token loop already re-checks each token's OWN additionalObjects for
    // matching deps — including sub-elements here as well meant they got
    // checked a SECOND time, but as "objects" with no id/cardId of their own,
    // so _resolveParentId("card", subElement) came back undefined and the
    // parentId guard failed open — any card's property change matched every
    // OTHER token's label sub-element indiscriminately. Only the real
    // top-level token has isToken === true; sub-elements are isTokenUI.
    return this._getCanvas()
      .getObjects()
      .filter((o) => o.tokenData != null && o.isToken === true);
  }

  // ── Map / game context shortcuts ──────────────────────────────────────────

  _getSelectedMap() {
    return ClientMediator.sendCommand("BattleMap", "GetSelectedMap", {
      contextId: this.contextId,
    });
  }

  _getGameId() {
    return ClientMediator.sendCommand("Game", "GetGameId");
  }
}

const ownMeta = {
};

installFeatures(TokenManager, ownMeta, [tokenUiActions, tokenMasks, tokenProperties, tokenLoading, tokenCreation, tokenLayout]);

export default TokenManager;
