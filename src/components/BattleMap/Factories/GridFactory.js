import { fabric } from "fabric";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import ClientMediator from "../../../ClientMediator";
import { RESERVED_LAYERS } from "../Constants/layers";

// Matches the backend's default for new maps: subtle over battle map images.
export const DEFAULT_GRID_COLOR = "rgba(170, 170, 170, 0.35)";

/**
 * The grid lines to draw for a map of width × height: x positions (vertical lines) and
 * y positions (horizontal lines), every gridSize plus the map's own border, limited to
 * `view` (the part of the map on screen, in map coordinates) when given. from/to are
 * where the lines start and end — the visible part of the map.
 */
export function visibleGridLines({ width, height, gridSize, view }) {
  const from = { x: Math.max(0, view?.left ?? 0), y: Math.max(0, view?.top ?? 0) };
  const to = { x: Math.min(width, view?.right ?? width), y: Math.min(height, view?.bottom ?? height) };
  const lines = (start, end, size) => {
    const out = [];
    if (end < start || !(gridSize > 0)) return out;
    for (let v = Math.ceil(start / gridSize) * gridSize; v <= end; v += gridSize) out.push(v);
    // The map's far border, also when the map isn't a whole number of squares.
    if (size >= start && size <= end && out[out.length - 1] !== size) out.push(size);
    return out;
  };
  // Off screen in either direction: nothing of it is in view.
  if (to.x < from.x || to.y < from.y) return { xs: [], ys: [], from, to };
  return { xs: lines(from.x, to.x, width), ys: lines(from.y, to.y, height), from, to };
}

// One object for the whole grid. It used to be a group of one Fabric line per grid line,
// every one of them drawn on every frame (pan, zoom, token drag) whether on screen or
// not; this draws only the lines in view, as one path with one stroke. Not cached: what
// it draws depends on the view.
const GridObject = fabric.util.createClass(fabric.Rect, {
  type: "grid",

  _render(ctx) {
    const vpt = this.canvas?.vptCoords;
    const view = vpt
      ? { left: vpt.tl.x - this.left, top: vpt.tl.y - this.top, right: vpt.br.x - this.left, bottom: vpt.br.y - this.top }
      : undefined;
    const { xs, ys, from, to } = visibleGridLines({ width: this.width, height: this.height, gridSize: this.gridSize, view });
    if (!xs.length && !ys.length) return;

    // Fabric draws an object around its centre.
    const ox = -this.width / 2;
    const oy = -this.height / 2;
    ctx.save();
    ctx.beginPath();
    for (const x of xs) {
      ctx.moveTo(ox + x, oy + from.y);
      ctx.lineTo(ox + x, oy + to.y);
    }
    for (const y of ys) {
      ctx.moveTo(ox + from.x, oy + y);
      ctx.lineTo(ox + to.x, oy + y);
    }
    ctx.strokeStyle = this.gridColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },
});

class GridFactory {
  DrawGrid = (gridSize, size, mapId, gridColor) => {
    gridColor = gridColor || DEFAULT_GRID_COLOR; // also when the map has null

    let grp = new GridObject({
      left: 0,
      top: 0,
      width: size[0],
      height: size[1],
      originX: "left",
      originY: "top",
      fill: "transparent",
      strokeWidth: 0,
      gridSize,
      gridColor,
      name: ".grid",
      selectable: false,
      layer: RESERVED_LAYERS.GRID,
      objectCaching: false,
    });

    //disallow grp object to be modified in any way
    grp.lockMovementX = true;
    grp.lockMovementY = true;
    grp.lockScalingX = true;
    grp.lockScalingY = true;
    grp.lockRotation = true;
    grp.lockUniScaling = true;
    grp.lockSkewingX = true;
    grp.lockSkewingY = true;
    grp.lockScalingFlip = true;
    grp.hasControls = true;

    grp.controls.changeGridSize = new fabric.Control({
      x: -0.5 + (gridSize / size[0]),
      y: -0.5,
      offsetX: 0,
      offsetY: 0,
      cornerSize: 40,
      sizeX: 13,
      sizeY: 50,
      visible: false,

      cursorStyleHandler: function () {
        return "pointer";
      },

      actionHandler: function (eventData, transform, x, y) {
        let target = transform.target;
        let point = new fabric.Point(x, y);
        let localPoint = transform.target.toLocalPoint(
          point,
          transform.originX,
          transform.originY
        );
        let newWidth = Math.abs(localPoint.x / target.scaleX);
        let calcedWidth = Number(Math.max(newWidth, 0).toFixed(0));
        if(calcedWidth < 25)
        {
          calcedWidth = 25;
        }
        target.set("newGridSize", calcedWidth);
        transform.target.canvas.requestRenderAll();
      },

      mouseUpHandler: function (eventData, transform) {
        const target = transform.target;
        const command = {
          command: "settings_map",
          data: {
            id: mapId,
            gridSize: target.newGridSize,
            action: "gridEdit",
          },
        };

        WebSocketManagerInstance.Send(command);
      },

      render: function (ctx, left, top, styleOverride, fabricObject) {
        //get viewport transform
        let vp = fabricObject.canvas.viewportTransform;

        let originalGridSize = gridSize;
        let potentialNewGridSize = fabricObject.newGridSize || gridSize;

        ctx.save();
        ctx.translate(left, top);
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.fillRect(- originalGridSize * vp[0], -20, 3, 20);
        ctx.fillRect(0 + (potentialNewGridSize - originalGridSize)  * vp[0], -20, 5, 20);
        ctx.fillRect((-originalGridSize) * vp[0] + 3,-10, (originalGridSize + (potentialNewGridSize - originalGridSize)) * vp[0] - 3, 3);
        ctx.font = "20px Arial";
        ctx.fillText(potentialNewGridSize + "px", 0, -30)
        ctx.restore();
      },
    });

    grp.controls.changeGrid = new fabric.Control({
      x: 0.5,
      y: 0.5,
      offsetX: 0,
      offsetY: 0,
      visible: false,

      cursorStyleHandler: function () {
        return "pointer";
      },

      actionHandler: function (eventData, transform, x, y) {
        transform.target.visible = false;
        transform.target.setControlVisible("changeGridSize", false);
        let target = transform.target;
        let point = new fabric.Point(x, y);
        let localPoint = transform.target.toLocalPoint(
          point,
          transform.originX,
          transform.originY
        );
        let newWidth = Math.abs(localPoint.x / target.scaleX);
        let newHeight = Math.abs(localPoint.y / target.scaleY);
        target.set("width", Math.max(newWidth, 0));
        target.set("height", Math.max(newHeight, 0));
        transform.target.canvas.requestRenderAll();
      },

      mouseUpHandler: function (eventData, transform) {
        const target = transform.target;
        const command = {
          command: "settings_map",
          data: {
            id: mapId,
            width: target.width,
            height: target.height,
            action: "gridEdit"
          },
        };

        WebSocketManagerInstance.Send(command);
      },

      render: function (ctx, left, top, styleOverride, fabricObject) {
        ctx.save();
        ctx.translate(left, top);
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
      },
    });

    //hide all controls except custom one
    grp.setControlsVisibility({
      tl: false,
      tr: false,
      br: false,
      bl: false,
      ml: false,
      mt: false,
      mr: false,
      mb: false,
      mtr: false,
      changeGrid: true,
      changeGridSize: true,
    });

    return grp;
  };
}

const GridFactoryInstance = new GridFactory();
export default GridFactoryInstance;
