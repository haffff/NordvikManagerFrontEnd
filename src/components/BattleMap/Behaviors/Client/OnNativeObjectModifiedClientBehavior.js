import ClientMediator from "../../../../ClientMediator";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import DTOConverter from "../../DTOConverter";
import CommandFactory from "../../Factories/CommandFactory";
import { fabric } from "fabric";
import { getSnapSettings, shouldSnapNow } from "../../../../helpers/mapSnapSettings";
import { snapScaledBox } from "../../Helpers/gridSnap";

const SCALE_ACTIONS = ["scale", "scaleX", "scaleY"];

// The keys held: at release (event.e), or when the drag started (event.transform).
const heldKeys = (event) => {
  const e = event.e ?? {};
  const t = event.transform ?? {};
  return {
    altKey: !!(e.altKey || t.altKey),
    shiftKey: !!(e.shiftKey || t.shiftKey),
    ctrlKey: !!(e.ctrlKey || t.ctrlKey),
    metaKey: !!(e.metaKey || t.metaKey),
  };
};

// Which edges the handle being dragged moves: the transform's origin is the fixed side.
const movingEdge = (origin, start, end) => (origin === start ? end : origin === end ? start : "both");

// Scaling a single, unrotated, top-left-origin element: its dragged edges land on grid lines.
function snapScale(target, transform, map, alignMode) {
  if (target.type === "activeSelection" || (target.angle ?? 0) % 360 !== 0) return;
  if ((target.originX ?? "left") !== "left" || (target.originY ?? "top") !== "top") return;
  if (!(target.width > 0) || !(target.height > 0)) return;

  const box = snapScaledBox(
    { left: target.left, top: target.top, width: target.width * target.scaleX, height: target.height * target.scaleY },
    {
      gridSize: map.gridSize,
      offset: alignMode === "center" ? map.gridSize / 2 : 0,
      moveX: transform.action === "scaleY" ? null : movingEdge(transform.originX, "left", "right"),
      moveY: transform.action === "scaleX" ? null : movingEdge(transform.originY, "top", "bottom"),
      // A corner keeps the proportions (no stretched images); a side handle changes one side.
      keepRatio: transform.action === "scale",
    }
  );
  target.set({ left: box.left, top: box.top, scaleX: box.width / target.width, scaleY: box.height / target.height });
  target.setCoords?.();
}

export class OnNativeObjectModifiedClientBehavior {
  Handle(event, canvas, map, battleMapId) {
    var renderGrid = map.gridVisible;
    const isMultiSelect = event.target.type === "activeSelection";
    const action = event.transform?.action;
    const gridOn = renderGrid && canvas.alignMode !== "none";
    const snapSettings = getSnapSettings();
    const keys = heldKeys(event);
    const isScale = SCALE_ACTIONS.includes(action);

    if (gridOn && isScale && shouldSnapNow(snapSettings.scale, keys)) {
      snapScale(event.target, event.transform, map, canvas.alignMode);
    }

    // Only a move: snapping the position after a rotation would shift the element here
    // while only its angle is sent.
    const shouldSnap = gridOn && action === "drag" && shouldSnapNow(snapSettings.move, keys);

    if (shouldSnap) {
      var gridSize = map.gridSize;

      if (!isMultiSelect) {
        // Single object: event.target.left is the left edge (originX:'left') — snap directly.
        let x = Math.round(event.target.left / gridSize) * gridSize;
        let y = Math.round(event.target.top / gridSize) * gridSize;

        if (canvas.alignMode === "center") {
          x += gridSize / 2;
          y += gridSize / 2;
        }

        event.target.set({ left: x, top: y });
      } else {
        // ActiveSelection: fabric.Group uses originX:'center', so event.target.left is the
        // bounding-box CENTER, not the left edge. Derive the left/top edges, snap those,
        // then apply the resulting delta back to the group center so that
        // discardActiveObject() restores objects at the correct snapped canvas positions
        // without a visual flash.
        var leftEdge = event.target.left - event.target.width / 2;
        var topEdge  = event.target.top  - event.target.height / 2;

        var snappedLeft = Math.round(leftEdge / gridSize) * gridSize;
        var snappedTop  = Math.round(topEdge  / gridSize) * gridSize;

        if (canvas.alignMode === "center") {
          snappedLeft += gridSize / 2;
          snappedTop  += gridSize / 2;
        }

        event.target.set({
          left: event.target.left + (snappedLeft - leftEdge),
          top:  event.target.top  + (snappedTop  - topEdge),
        });
      }
    }

    if (isMultiSelect) {
      event.target.forEachObject(async (subelement) => {
        if (subelement.id && subelement.additionalObjects) {
          await ClientMediator.sendCommandAsync(
            "BattleMap_Token",
            "UpdateTokenUIPositions",
            { object: subelement, contextId: battleMapId }
          );
        }
      });
    } else {
      if (event.target.id && event.target.additionalObjects) {
        ClientMediator.sendCommandAsync(
          "BattleMap_Token",
          "UpdateTokenUIPositions",
          { object: event.target, contextId: battleMapId }
        );
      }
    }

    if (!isMultiSelect) {
      let action = event.transform?.action;
      SendObject(event.target, action);
    } else {
      let objects = canvas.getActiveObjects();
      let action = event.transform?.action;
      canvas.discardActiveObject();

      objects.forEach((element) => {
        SendObject(element, action);
      });
      var sel = new fabric.ActiveSelection(objects, {
        canvas: canvas,
      });
      canvas.setActiveObject(sel);
    }

    function SendObject(target, action) {
      //const dto = DTOConverter.ConvertToDTO(target);
      let dto = {};
      //If action is drag we need to call minified converttodto with only necessary fields
      switch(action)
      {
        case "drag":
          dto = DTOConverter.ConvertToDTOMinified(target, ["left", "top"]);
          // Flags this object's own drag-confirmation echo so
          // OnUpdateElementBehavior's isOwnDrag check can skip re-animating it —
          // the local object already sits at its final position, so re-animating
          // its own echo just risks a stutter (and, worse, a token-UI hide/restore
          // race if a second update lands before the animation's onComplete).
          // Consumed (cleared) by OnUpdateElementBehavior when that echo arrives.
          target.isBeingDragged = true;
          break;
        case "scale":
        case "scaleX":
        case "scaleY":
          // Position too: scaling from a top or left handle (or onto the grid) moves it.
          // And the size the scale applies to: a token's image set from a property
          // changes width/height on the client only, so the saved ones can be the
          // placeholder's and the scale alone would shrink the token on reload.
          dto = DTOConverter.ConvertToDTOMinified(target, ["left", "top", "width", "height", "scaleX", "scaleY"]);
          break;
        case "rotate":
          dto = DTOConverter.ConvertToDTOMinified(target, ["angle"]);
          break;
        default:
          dto = DTOConverter.ConvertToDTO(target);
      }

      let cmd = CommandFactory.CreateBattleMapUpdateCommand(
        dto,
        battleMapId,
        action
      );
      console.log(cmd);
      WebSocketManagerInstance.Send(cmd);
    }
  }
}
