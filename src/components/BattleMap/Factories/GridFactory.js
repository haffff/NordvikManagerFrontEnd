import { fabric } from "fabric";
import WebSocketManagerInstance from "../../game/WebSocketManager";
import ClientMediator from "../../../ClientMediator";

class GridFactory {
  DrawGrid = (gridSize, size, mapId) => {
    let gridArr = [];

    for (var i = 0; i < size[0] / gridSize; i++) {
      let line = new fabric.Line([i * gridSize, 0, i * gridSize, size[1]], {
        name: ".line",
        type: "line",
        stroke: "#aaa",
        selectable: false,
        layer: 0,
      });
      gridArr.push(line);
    }

    for (var i = 0; i < size[1] / gridSize; i++) {
      let line = new fabric.Line([0, i * gridSize, size[0], i * gridSize], {
        name: ".line",
        type: "line",
        stroke: "#aaa",
        selectable: false,
        layer: 0,
      });
      gridArr.push(line);
    }

    let line = new fabric.Line([size[0], 0, size[0], size[1]], {
      name: ".line",
      type: "line",
      stroke: "#aaa",
      selectable: false,
      layer: 0,
    });
    gridArr.push(line);

    line = new fabric.Line([0, size[1], size[0], size[1]], {
      name: ".line",
      type: "line",
      stroke: "#aaa",
      selectable: false,
      layer: 0,
    });
    gridArr.push(line);

    //ClientMediator.sendCommand("Ga")

    let grp = new fabric.Group(gridArr, {
      originX: "left",
      originY: "top",
      name: ".grid",
      selectable: false,
      interactive: false,
      layer: 0,
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
        let calcedWidth = Math.max(newWidth, 0).toFixed(0);
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
