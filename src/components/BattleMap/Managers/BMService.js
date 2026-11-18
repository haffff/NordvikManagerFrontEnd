import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import ClientMediator from "../../../ClientMediator";
import { installFeatures } from "./installFeatures";
import { mapCommands } from "./battlemap/mapCommands";
import { layerCommands } from "./battlemap/layerCommands";
import { elementCommands } from "./battlemap/elementCommands";
import { drawingModes } from "./battlemap/drawingModes";
import { measureMode } from "./battlemap/measureMode";
import { targetModes } from "./battlemap/targetModes";

export { ungroupedParts } from "./battlemap/elementCommands";

class BMService {
  _clipboard = undefined;

  constructor({ canvas, battleMapModel, queryService, reload, changeMap } = {}) {
    this._canvas = canvas;
    this._battleMapModel = battleMapModel;
    this._BMQueryService = queryService;
    this._reloadCommand = reload;
    this._changeMapCommand = changeMap;
    this.panel = "battlemap";
    this.contextId = battleMapModel?.id;
    this.id = "BMService" + battleMapModel?.id;
  }

  DisableAllModes() {
    const canvas = this._canvas;
    this.SetActionToolMode({ enabled: false });
    this.CancelPickTargets();
    this.CancelPickPoint();
    this.SetSimpleCreateMode({ enabled: false });
    this.SetFreeDrawMode({ enabled: false });
    this.UnsetTokenSelectMode({});
    // Pass the current editLayer so SetLayerEditMode's layer===undefined guard doesn't short-circuit
    this.SetLayerEditMode({ editMode: false, layer: canvas.editLayer ?? canvas.selectedLayer });
    this.SetMeasureMode({ enabled: false });
  }

  CleanPreviews() {
    const currentPlayer = ClientMediator.sendCommand("Game", "GetCurrentPlayer");
    const canvas = this._canvas;
    // Sketches are previews too, but they're notes: only Undo/CleanSketches remove them.
    const filteredObjects = canvas.getObjects().filter(
      (object) => object.previewId && !object.sketch && object.playerId === currentPlayer.id
    );

    filteredObjects.forEach((object) => {
      canvas.remove(object);
    });
    
    if (canvas.measure?.visibleToOthers === true) {
      WebSocketManagerInstance.Send({
        command: "preview_end",
        battleMapId: this.contextId,
        // Flat array of {previewId, playerId}, matching every other preview_end
        // sender (e.g. OnMouseUpMeasureEnds.js) — this used to be wrapped in an
        // extra [ ], the only preview_end sent for "stay visible" previews.
        data: filteredObjects.map((object) => ({ previewId: object.previewId, playerId: object.playerId })),
      });
    }

    canvas.requestRenderAll();
  }

  _addPopupAndOverlay(overlayContent, popupContent) {
    if (overlayContent) {
      ClientMediator.sendCommand("BattleMap", "ShowOverlay", {
        contextId: this.contextId,
        content: overlayContent,
      });
    }

    if (popupContent) {
      ClientMediator.sendCommand("BattleMap", "ShowPopup", {
        contextId: this.contextId,
        content: popupContent,
      });
    }
  }

  _removePopupAndOverlay() {
    ClientMediator.sendCommand("BattleMap", "HideOverlay", {
      contextId: this.contextId,
    });

    ClientMediator.sendCommand("BattleMap", "HidePopup", {
      contextId: this.contextId,
    });
  }
}

const ownMeta = {
  DisableAllModes: {
    description: 'Exits all active canvas modes (draw, measure, token-select, edit-layer, etc.).',
    args: [],
  },
  CleanPreviews: {
    description: "Removes the current player's preview objects (measurements) from the canvas. Sketches stay; see CleanSketches.",
    args: [],
  },
};

installFeatures(BMService, ownMeta, [mapCommands, layerCommands, elementCommands, drawingModes, measureMode, targetModes]);

export default BMService;
