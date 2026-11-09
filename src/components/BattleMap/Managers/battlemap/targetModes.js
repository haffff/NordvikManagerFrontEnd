import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import { fabric } from "fabric";
import ClientMediator from "../../../../ClientMediator";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import { RESERVED_LAYERS } from "../../Constants/layers";
import * as React from "react";
import ActionToolOverlay from "../../Overlays/ActionToolOverlay";
import PickTargetsOverlay from "../../Overlays/PickTargetsOverlay";
import { startPicking, togglePick, isCandidate, isPickable, clickAt } from "../../Behaviors/Client/PickTargets/pickTargets";
import { startPointing, pointerAt, areaAt, throttled } from "../../Behaviors/Client/PickPoint/pickPoint";
import { glowTokensIn, glow, glowUpdate } from "../../Helpers/areaGlow";
import { areaColors } from "../../Helpers/areaColors";
import { buildAreaObject, placeArea } from "../../Helpers/buildArea";
import PickPointOverlay from "../../Overlays/PickPointOverlay";

// Modes that pick something on the map: tokens, targets, a point, an action's tool.
export const targetModes = {
  meta: {
    SetTokenSelectMode: {
      description: 'Locks the canvas into token-selection mode with optional min/max token count.',
      args: [
        { name: 'minTokens', type: 'number', required: false },
        { name: 'maxTokens', type: 'number', required: false },
      ],
    },
    UnsetTokenSelectMode: {
      description: 'Exits token-selection mode and restores object selectability.',
      args: [],
    },
    SetActionToolMode: {
      description: 'Enables or disables an addon map tool (Add Map Tool step): while on, clicking the map runs the action of the tool with the click position and element.',
      args: [
        { name: 'enabled', type: 'boolean', required: true },
        { name: 'tool', type: 'object', required: false },
      ],
    },
    SetPickTargetsMode: {
      description: 'Lets the player pick tokens (or, with target "element", any elements) on the map for an action (RequestTargets): request { message, target, min, max, candidates }; onDone(state) gets { picked, position } when Done, or null when cancelled.',
      args: [
        { name: 'enabled', type: 'boolean', required: true },
        { name: 'request', type: 'object', required: false },
        { name: 'onDone', type: 'function', required: false },
      ],
    },
    FinishPickTargets: {
      description: 'Ends picking tokens with what is picked (when at least min are).',
      args: [],
    },
    CancelPickTargets: {
      description: 'Ends picking tokens without an answer.',
      args: [],
    },
    SetPickPointMode: {
      description: 'Lets the player point at a place on the map for an action (RequestPoint): request { message, area, from, snap, gridSize, range, highlight, showToOthers }; onDone(state) gets { position } when chosen, or null when cancelled.',
      args: [
        { name: 'enabled', type: 'boolean', required: true },
        { name: 'request', type: 'object', required: false },
        { name: 'onDone', type: 'function', required: false },
      ],
    },
    PickPointMove: {
      description: 'While pointing: moves the marker to position (map pixels).',
      args: [{ name: 'position', type: 'object', required: true }],
    },
    PickPointClick: {
      description: 'While pointing: chooses position when it is within range.',
      args: [{ name: 'position', type: 'object', required: true }],
    },
    CancelPickPoint: {
      description: 'Ends pointing without an answer.',
      args: [],
    },
    PickTargetsClick: {
      description: 'While picking tokens: toggles the token clicked (elementId) and remembers where (position).',
      args: [{ name: 'elementId', type: 'string', required: false }, { name: 'position', type: 'object', required: false }],
    },
  },

  methods: {
    SetTokenSelectMode({
      minTokens,
      maxTokens,
      popupContent,
      overlayContent,
      isCommand,
    }) {
      const canvas = this._canvas;

      if (canvas.modeLock || canvas.editLock) {
        console.warn("Mode is locked, cannot change token select mode.");
        return;
      }

      canvas.tokenSelectMode = true;
      canvas.modeLock = true;
      canvas.contextMenuLock = true;
      canvas.discardActiveObject();
      canvas.minTokens = minTokens ?? 1;
      canvas.maxTokens = maxTokens ?? 1;
      canvas.tokens = [];

      this.SetSelectedLayer({ layerId: RESERVED_LAYERS.TOKEN, withEditMode: false });
      this._addPopupAndOverlay(overlayContent, popupContent);

      canvas.getObjects().forEach((object) => {
        const isToken = !!object.tokenData;
        object.set({
          beforeTokenSelectSelectable: object.selectable,
          selectable: false,
          beforeTokenSelectEditable: object.editable,
          editable: false,
          beforeTokenSelectOpacity: object.opacity,
          opacity: isToken ? 1 : 0.4,
        });
      });

      ClientMediator.fireEvent("BattleMap_ModeChanged", {
        battleMapId: this.contextId,
        mode: "TokenSelect",
      });
    },

    UnsetTokenSelectMode({ isCommand }) {
      const canvas = this._canvas;

      // Not on: nothing to undo (DisableAllModes asks every mode to turn off).
      if (!canvas.tokenSelectMode) return;

      canvas.tokenSelectMode = undefined;
      canvas.modeLock = undefined;
      canvas.contextMenuLock = undefined;
      canvas.minTokens = undefined;
      canvas.maxTokens = undefined;
      canvas.tokens = undefined;

      this._removePopupAndOverlay();

      canvas.getObjects().forEach((object) => {
        object.set({
          selectable: object.beforeTokenSelectSelectable,
          beforeTokenSelectSelectable: undefined,
          editable: object.beforeTokenSelectEditable,
          beforeTokenSelectEditable: undefined,
          opacity: object.beforeTokenSelectOpacity,
          beforeTokenSelectOpacity: undefined,
        });
      });

      ClientMediator.fireEvent("BattleMap_ModeChanged", {
        battleMapId: this.contextId,
        mode: undefined,
        modeType: undefined,
      });
    },

    // An addon map tool (Add Map Tool step). While active, a map click runs the tool's
    // action (Behaviors/Client/ActionTool/OnMouseDownActionTool.js).
    // tool: { name, uiName, action, hint, target: 'point'|'token'|'element', stayActive, actionArgs }
    SetActionToolMode({ enabled, tool, isCommand }) {
      if (isCommand && enabled === undefined) {
        return "enabled is required.";
      }

      const canvas = this._canvas;

      if (enabled) {
        if (!tool?.name || !tool?.action) {
          return "tool with name and action is required.";
        }
        if (canvas.modeLock) {
          console.warn("Mode is locked, cannot change action tool mode.");
          return;
        }

        canvas.modeLock = true;
        canvas.contextMenuLock = true;
        canvas.discardActiveObject();
        canvas.actionTool = tool;
        canvas.modeType = tool.name;
        canvas.selection = false;
        canvas.defaultCursor = "crosshair";
        // Clicks still target objects (opt.target), but don't select or drag them.
        canvas.getObjects().forEach((object) => {
          object.set({ beforeActionToolSelectable: object.selectable, selectable: false });
        });

        this._addPopupAndOverlay(
          React.createElement(ActionToolOverlay, { key: this.contextId + "_ActionTool", battleMapId: this.contextId, tool })
        );

        ClientMediator.fireEvent("BattleMap_ModeChanged", {
          battleMapId: this.contextId,
          mode: "ActionTool",
          type: tool.name,
        });
      } else if (canvas.actionTool) {
        canvas.modeLock = undefined;
        canvas.contextMenuLock = undefined;
        canvas.actionTool = undefined;
        canvas.modeType = undefined;
        canvas.selection = true;
        canvas.defaultCursor = "default";
        canvas.getObjects().forEach((object) => {
          if (object.beforeActionToolSelectable === undefined) return;
          object.set({ selectable: object.beforeActionToolSelectable, beforeActionToolSelectable: undefined });
        });
        canvas.requestRenderAll();

        this._removePopupAndOverlay();

        ClientMediator.fireEvent("BattleMap_ModeChanged", {
          battleMapId: this.contextId,
          mode: undefined,
          type: undefined,
        });
      }
    },

    // Picking tokens for an action (RequestTargets, the editor's "Run from map"). Clicks are
    // handled by Behaviors/Client/PickTargets/OnMouseDownPickTargets.js. Tokens that can't be
    // picked are dimmed and picked ones glow — on this screen only, nothing is saved.
    SetPickTargetsMode({ enabled, request, onDone }) {
      const canvas = this._canvas;
      if (enabled) {
        if (canvas.modeLock || canvas.pickTargets) {
          onDone?.(null);
          return;
        }
        canvas.modeLock = true;
        canvas.contextMenuLock = true;
        canvas.discardActiveObject();
        canvas.selection = false;
        canvas.defaultCursor = "pointer";
        const picking = { state: startPicking(request), onDone, listeners: new Set() };
        canvas.pickTargets = picking;
        canvas.getObjects().forEach((object) => {
          object.set({ beforePickSelectable: object.selectable, selectable: false });
          if (isPickable(picking.state, object) && !isCandidate(picking.state, object.id)) {
            object.set({ beforePickOpacity: object.opacity, opacity: (object.opacity ?? 1) * 0.35 });
          }
        });
        canvas.requestRenderAll();
        this._addPopupAndOverlay(
          React.createElement(PickTargetsOverlay, { key: this.contextId + "_PickTargets", battleMapId: this.contextId, picking })
        );
        ClientMediator.fireEvent("BattleMap_ModeChanged", { battleMapId: this.contextId, mode: "PickTargets", type: undefined });
        return;
      }
      this._endPicking(false);
    },

    // A click on the map while picking: toggles the token clicked (if any) and remembers where.
    PickTargetsClick({ elementId, position }) {
      const picking = this._canvas.pickTargets;
      if (!picking) return;
      picking.state = clickAt(elementId ? togglePick(picking.state, elementId) : picking.state, position);
      this._canvas.getObjects().forEach((object) => {
        if (!isPickable(picking.state, object)) return;
        glow(object, picking.state.picked.includes(object.id), "beforePickShadow", this._myColors().glow);
      });
      this._canvas.requestRenderAll();
      picking.listeners.forEach((listener) => listener(picking.state));
    },

    FinishPickTargets() {
      const picking = this._canvas.pickTargets;
      if (picking && picking.state.picked.length >= picking.state.min) this._endPicking(true);
    },

    CancelPickTargets() {
      this._endPicking(false);
    },

    _endPicking(finished) {
      const canvas = this._canvas;
      const picking = canvas.pickTargets;
      if (!picking) return;
      canvas.pickTargets = undefined;
      canvas.modeLock = undefined;
      canvas.contextMenuLock = undefined;
      canvas.selection = true;
      canvas.defaultCursor = "default";
      canvas.getObjects().forEach((object) => {
        if (object.beforePickSelectable !== undefined) object.set({ selectable: object.beforePickSelectable, beforePickSelectable: undefined });
        if (object.beforePickOpacity !== undefined) object.set({ opacity: object.beforePickOpacity, beforePickOpacity: undefined });
        if (object.beforePickShadow !== undefined) object.set({ shadow: object.beforePickShadow, beforePickShadow: undefined });
      });
      canvas.requestRenderAll();
      this._removePopupAndOverlay();
      ClientMediator.fireEvent("BattleMap_ModeChanged", { battleMapId: this.contextId, mode: undefined, type: undefined });
      picking.onDone?.(finished ? picking.state : null);
    },

    // Pointing at a place for an action (RequestPoint). The area (Helpers/buildArea.js, the
    // shapes markers and Find use) follows the cursor — Behaviors/Client/PickPoint — snapped to
    // the grid; a line or cone starts at `from` and only turns. The range shows as a dashed
    // ring; tokens the area covers (Helpers/areaShape.js, Find's rule) glow in the player's
    // colour; with showToOthers the others see it move (preview_start / _update / _end).
    SetPickPointMode({ enabled, request, onDone }) {
      const canvas = this._canvas;
      if (!enabled) {
        this._endPointing(null);
        return;
      }
      if (canvas.modeLock || canvas.pickPoint || canvas.pickTargets) {
        onDone?.(null);
        return;
      }
      canvas.modeLock = true;
      canvas.contextMenuLock = true;
      canvas.discardActiveObject();
      canvas.selection = false;
      canvas.defaultCursor = "crosshair";
      canvas.getObjects().forEach((object) => object.set({ beforePickSelectable: object.selectable, selectable: false }));

      const state = startPointing(request, this._BMQueryService.GetSelectedMap()?.gridSize);
      const mine = this._myColors();
      const colors = { fill: state.area?.fill ?? mine.fill, stroke: state.area?.stroke ?? mine.stroke };
      const pointing = { state, onDone, colors, listeners: new Set(), shapes: [], sendUpdate: throttled((data) => this._sendPreview("preview_update", data), 50) };
      canvas.pickPoint = pointing;
      const shared = { preview: true, playerId: ClientMediator.sendCommand("Game", "GetCurrentPlayer")?.id, stayVisible: true };

      if (state.range) {
        pointing.shapes.push(new fabric.Circle({
          left: state.range.x, top: state.range.y, radius: state.range.radius, originX: "center", originY: "center",
          fill: "rgba(255,255,255,0.04)", stroke: colors.stroke, strokeWidth: 2, strokeDashArray: [10, 8], selectable: false, evented: false,
        }));
      }
      if (state.area) {
        pointing.area = buildAreaObject(state.area, { at: state.from ?? { x: 0, y: 0 }, ...colors });
        pointing.area.set({ visible: false });
        pointing.shapes.push(pointing.area);
      }
      pointing.shapes.forEach((shape) => {
        shape.set({ ...shared, previewId: UtilityHelper.GenerateUUID() });
        canvas.add(shape);
        shape.bringToFront();
      });
      if (state.showToOthers && pointing.shapes.length) this._sendPreview("preview_start", pointing.shapes);
      canvas.requestRenderAll();

      this._addPopupAndOverlay(
        React.createElement(PickPointOverlay, { key: this.contextId + "_PickPoint", battleMapId: this.contextId, pointing })
      );
      ClientMediator.fireEvent("BattleMap_ModeChanged", { battleMapId: this.contextId, mode: "PickPoint", type: undefined });
    },

    // The pointer moved while pointing: the area follows (or turns); where it can't be chosen
    // it is faded and dashed, with a red outline.
    PickPointMove({ position }) {
      const canvas = this._canvas;
      const pointing = canvas.pickPoint;
      if (!pointing || !position) return;
      pointing.state = pointerAt(pointing.state, position);
      const { state, area, colors } = pointing;
      if (area) {
        const aimed = state.from && (state.area.shape === "line" || state.area.shape === "cone");
        const moved = aimed ? placeArea(area, state.area, state.from, state.position) : placeArea(area, state.area, state.position);
        const look = state.allowed
          ? { visible: true, opacity: 1, stroke: colors.stroke, strokeDashArray: null }
          : { visible: true, opacity: 0.5, stroke: "rgba(255,60,60,0.95)", strokeDashArray: [8, 6] };
        area.set(look);
        // The others see the area move and, with highlight on, the same tokens light up.
        const shared = state.highlight ? { glow: glowUpdate(state.allowed ? areaAt(state) : null, this._myColors().glow, state.fromId) } : {};
        if (state.showToOthers) pointing.sendUpdate([{ previewId: area.previewId, ...moved, ...look, ...shared }]);
      }
      if (state.highlight) this._glowCovered(pointing);
      canvas.requestRenderAll();
      pointing.listeners.forEach((listener) => listener(pointing.state));
    },

    // A click while pointing: chooses the point when it may be chosen there.
    PickPointClick({ position }) {
      const pointing = this._canvas.pickPoint;
      if (!pointing || !position) return;
      this.PickPointMove({ position });
      if (pointing.state.allowed) this._endPointing(pointing.state);
    },

    CancelPickPoint() {
      this._endPointing(null);
    },

    // Tokens the area covers glow (as picked tokens do), others go back to how they were.
    _glowCovered(pointing) {
      const { state } = pointing;
      glowTokensIn(this._canvas, state.allowed ? areaAt(state) : null, this._myColors().glow, "beforePointShadow", state.fromId);
    },

    // The colours of this player's areas and glow: theirs, else the theme's, else orange.
    _myColors() {
      return areaColors(ClientMediator.sendCommand("Game", "GetCurrentPlayer")?.color);
    },

    _sendPreview(command, data) {
      WebSocketManagerInstance.Send({ command, battleMapId: this.contextId, data });
    },

    _endPointing(chosen) {
      const canvas = this._canvas;
      const pointing = canvas.pickPoint;
      if (!pointing) return;
      canvas.pickPoint = undefined;
      canvas.modeLock = undefined;
      canvas.contextMenuLock = undefined;
      canvas.selection = true;
      canvas.defaultCursor = "default";
      pointing.sendUpdate.cancel();
      pointing.shapes.forEach((shape) => canvas.remove(shape));
      if (pointing.state.showToOthers && pointing.shapes.length) {
        this._sendPreview("preview_end", pointing.shapes.map((shape) => ({ previewId: shape.previewId })));
      }
      canvas.getObjects().forEach((object) => {
        if (object.beforePickSelectable !== undefined) object.set({ selectable: object.beforePickSelectable, beforePickSelectable: undefined });
        if (object.beforePointShadow !== undefined) object.set({ shadow: object.beforePointShadow, beforePointShadow: undefined });
      });
      canvas.requestRenderAll();
      this._removePopupAndOverlay();
      ClientMediator.fireEvent("BattleMap_ModeChanged", { battleMapId: this.contextId, mode: undefined, type: undefined });
      pointing.onDone?.(chosen);
    },
  },
};
