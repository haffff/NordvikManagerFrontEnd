import { fabric } from "fabric";
import ClientMediator from "../../../../ClientMediator";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import { glowTokensIn } from "../../Helpers/areaGlow";
import { areaColors } from "../../Helpers/areaColors";

// The ruler.
export const measureMode = {
  meta: {
    SetMeasureMode: {
      description: 'Enables or disables distance-measurement mode, loading grid/unit settings from the server.',
      args: [
        { name: 'enabled', type: 'boolean', required: true },
        { name: 'type', type: 'string', required: false },
      ],
    },
  },

  methods: {
    async SetMeasureMode({
      enabled,
      overlayContent,
      popupContent,
      type,
      isCommand,
      arrowObject,
      measureObject,
      additionalObject,
      playerColor,
    }) {
      if (isCommand && enabled === undefined) {
        return "enabled is required.";
      }

      const canvas = this._canvas;

      if (enabled) {
        if (canvas.modeLock) {
          console.warn("Mode is locked, cannot change measure mode.");
          return;
        }

        canvas.modeLock = true;
        canvas.discardActiveObject();
        canvas.measureMode = true;
        canvas.selection = false;
        canvas.modeType = type;
        canvas.measure = { visibleToOthers: true };

        this.SetDragMode({ enabled: false });
        canvas.dragModeLock = true;

        canvas.measure.measureType = type ?? 'Line';

        if (["Circle", "Cone", "Rect"].includes(type)) {
          // An area (Helpers/measure.js, buildArea.js — the shapes markers and Find use), in
          // the player's colours; the tokens it covers light up unless that's switched off.
          canvas.measure.colors = areaColors(playerColor);
          canvas.measure.highlightTokens = true;
          if (type === "Cone") canvas.measure.coneAngle = 53; // default D&D 5e cone (width = length)
        } else {
          canvas.measure.measureArrow = arrowObject ?? new fabric.LineArrow([0, 0, 0, 0], {
            strokeWidth: 2,
            stroke: playerColor,
            selectable: false,
          });
        }

        canvas.measure.measureObject = measureObject ?? new fabric.Textbox("0", {
          left: 0,
          top: 0,
          width: 200,
          height: 90,
          fontSize: 56,
          fill: playerColor,
          selectable: false,
          editable: false,
        });

        canvas.measure.additionalObject = additionalObject ?? undefined;

        // Fetch map and gameId in parallel — they don't depend on each other
        const [map, gameId] = await Promise.all([
          ClientMediator.sendCommandAsync("BattleMap", "GetSelectedMap", { contextId: this.contextId }),
          ClientMediator.sendCommandAsync("Game", "GetGameId", {}),
        ]);

        // Fetch both settings collections in parallel too
        const [measureSettings, gameMeasureSettings] = await Promise.all([
          ClientMediator.sendCommandAsync("Properties", "GetByNames", {
            parentId: map.id ?? map.Id,
            names: ["baseDistanceUnit", "useSquaredSystem", "baseDistancePerSquare"],
          }),
          ClientMediator.sendCommandAsync("Properties", "GetByNames", {
            parentId: gameId,
            names: ["baseDistanceUnit", "useSquaredSystem", "baseDistancePerSquare"],
          }),
        ]);

        // Single-pass: build a lookup map instead of 6 separate .find() calls
        const toMap = (arr) => Object.fromEntries((arr ?? []).map((s) => [s.name, s.value]));
        const ms = toMap(measureSettings);
        const gms = toMap(gameMeasureSettings);

        canvas.measure = {
          ...canvas.measure,
          units: ms.baseDistanceUnit ?? gms.baseDistanceUnit ?? "ft",
          realisticMeasure: UtilityHelper.ParseBool(ms.useSquaredSystem) ?? UtilityHelper.ParseBool(gms.useSquaredSystem) ?? false,
          distancePerSquare: ms.baseDistancePerSquare
            ? parseInt(ms.baseDistancePerSquare)
            : gms.baseDistancePerSquare
              ? parseInt(gms.baseDistancePerSquare)
              : 5,
        };

        this._addPopupAndOverlay(overlayContent, popupContent);

        canvas.getObjects().forEach((object) => {
          object.set({ beforeMeasureSelectable: object.selectable, selectable: false });
        });

        ClientMediator.fireEvent("BattleMap_ModeChanged", {
          battleMapId: this.contextId,
          mode: "Measure",
          type: type,
        });
      } else {
        if (canvas.measureMode) {
          this.CleanPreviews();
          glowTokensIn(canvas, null, "", "beforeMeasureShadow");
          canvas.modeLock = undefined;
          canvas.measureMode = undefined;
          canvas.selection = true;
          canvas.modeType = undefined;
          canvas.measure = undefined;
          canvas.dragModeLock = false;

          this._removePopupAndOverlay();

          // Measuring made everything unselectable: give each object what it had.
          canvas.getObjects().forEach((object) => {
            if (object.beforeMeasureSelectable !== undefined)
              object.set({ selectable: object.beforeMeasureSelectable, beforeMeasureSelectable: undefined });
          });

          ClientMediator.fireEvent("BattleMap_ModeChanged", {
            battleMapId: this.contextId,
            mode: undefined,
            type: undefined,
          });

          canvas.requestRenderAll();
        }
      }
    },

    SetMeasureObjects({ arrowObject, additionalObject }) {
      const canvas = this._canvas;

      if (canvas.measureMode) {
        canvas.measure.measureArrow ??= arrowObject;
        canvas.measure.additionalObject ??= additionalObject;
      }
    },
  },
};
