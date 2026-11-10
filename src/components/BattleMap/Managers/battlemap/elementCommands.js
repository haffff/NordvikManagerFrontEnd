import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import CommandFactory from "../../Factories/CommandFactory";
import { fabric } from "fabric";
import { selectAll } from "../../Helpers/MapSelection";
import DTOConverter from "../../DTOConverter";
import { toaster } from "../../../ui/toaster";

// What's done to the selected elements: group, remove, copy and paste.
/** A group's parts as fabric JSON, each placed on the map as it shows inside the group. */
export function ungroupedParts(group) {
  const groupMatrix = group.calcTransformMatrix();
  return group.getObjects().map((part) => {
    const at = fabric.util.qrDecompose(fabric.util.multiplyTransformMatrices(groupMatrix, part.calcOwnMatrix()));
    return {
      ...part.toObject(),
      id: part.id,
      originX: "center", originY: "center",
      left: at.translateX, top: at.translateY,
      angle: at.angle, scaleX: at.scaleX, scaleY: at.scaleY, skewX: at.skewX, skewY: at.skewY,
      flipX: false, flipY: false,
    };
  });
}

export const elementCommands = {
  meta: {
    GroupSelected: {
      description: 'Groups the currently selected objects into a single fabric Group.',
      args: [],
    },
    UngroupSelected: {
      description: 'Ungroups the selected group back into individual objects. (WIP)',
      args: [],
    },
    RemoveSelected: {
      description: 'Deletes all currently selected objects from the map.',
      args: [],
    },
    CopyElements: {
      description: 'Copies selected canvas objects to the internal clipboard.',
      args: [],
    },
    PasteElements: {
      description: 'Pastes clipboard objects at the given coordinates (or offset by 10px).',
      args: [
        { name: 'x', type: 'number', required: false },
        { name: 'y', type: 'number', required: false },
      ],
    },
  },

  methods: {
    // Tokens stay out of groups: in one, a token would be no token any more (no card, UI,
    // turn order); the server refuses them too. The group is written as JSON from the
    // parts' positions on the map, without touching the parts until the server answers.
    GroupSelected() {
      const selectedObjects = this._BMQueryService.GetSelectedObjects();
      if (!selectedObjects?.length) return;

      const isToken = (x) => x.isToken || x.isTokenUI;
      const parts = selectedObjects.filter((x) => !isToken(x) && x._objects === undefined);
      if (selectedObjects.some(isToken)) {
        toaster.create({
          title: "Tokens can't be grouped",
          description: parts.length >= 2 ? "Grouped the rest of the selection." : "Select at least two other things to group.",
          type: "info",
          duration: 5000,
        });
      }
      if (parts.length < 2) return;

      // Out of the selection, the parts' coordinates are the map's again.
      this._canvas.discardActiveObject();
      const boxes = parts.map((x) => x.getBoundingRect(true, true));
      const left = Math.min(...boxes.map((b) => b.left));
      const top = Math.min(...boxes.map((b) => b.top));
      const width = Math.max(...boxes.map((b) => b.left + b.width)) - left;
      const height = Math.max(...boxes.map((b) => b.top + b.height)) - top;
      const center = { x: left + width / 2, y: top + height / 2 };
      const layer = parts[0].layer;

      // A group's parts sit relative to its centre, each by its own centre here.
      const objects = parts.map((x) => {
        const at = x.getCenterPoint();
        return { ...x.toObject(), id: x.id, originX: "center", originY: "center", left: at.x - center.x, top: at.y - center.y };
      });
      const group = {
        type: "group", version: fabric.version, originX: "left", originY: "top",
        left, top, width, height, layer, objects,
      };

      const cmd = CommandFactory.CreateGroupCommand(
        { object: JSON.stringify(group), mapId: this._BMQueryService.GetSelectedMapID(), layer },
        parts.map((x) => x.id)
      );
      WebSocketManagerInstance.Send(cmd);
    },

    // Each part goes back where it shows on the map, the group's move, turn and scale
    // applied to it (as fabric's own applyTransformToObject does). The server gives the
    // parts back their properties and the group's rights.
    UngroupSelected() {
      const selectedObjects = this._BMQueryService.GetSelectedObjects();
      if (selectedObjects?.length !== 1 || !selectedObjects[0]._objects) return;

      const group = selectedObjects[0];
      const children = ungroupedParts(group).map((object) => ({
        id: object.id,
        object: JSON.stringify(object),
        layer: group.layer,
        mapId: group.mapId,
      }));
      WebSocketManagerInstance.Send(CommandFactory.CreateUngroupCommand(group.id, children));
    },

    SelectAll() {
      selectAll(this._canvas);
    },

    RemoveSelected() {
      let selectedObjects = this._BMQueryService.GetSelectedObjects();
      if (selectedObjects !== undefined) {
        selectedObjects.forEach((element) => {
          let cmd = CommandFactory.CreateDeleteCommand(element);
          WebSocketManagerInstance.Send(cmd);
        });
      }
    },

    CopyElements() {
      let objects = this._BMQueryService.GetSelectedObjects();
      this._canvas.discardActiveObject();
      let mapped = objects.map((element) => {
        let cloned = fabric.util.object.clone(element);
        return cloned;
      });

      this._clipboard = mapped;

      var sel = new fabric.ActiveSelection(objects, {
        canvas: this._canvas,
      });

      this._canvas.setActiveObject(sel);

      toaster.create({ title: "Copied", description: "Copied " + objects.length + " elements.", type: "success", duration: 5000 });
    },

    PasteElements({ coords, isCommand, x, y }) {
      if (isCommand && !x && !y) {
        return "x and y are required.";
      }
      if (isCommand) {
        coords = { x, y };
      }

      if (this._clipboard !== undefined) {
        // Resolve layer and mapId once — not per element
        const layer = this._BMQueryService.GetSelectedLayer();
        const mapId = this._BMQueryService.GetSelectedMapID();

        this._clipboard.forEach((element) => {
          if (coords) {
            element.left = coords.x;
            element.top = coords.y;
          } else {
            element.left += 10;
            element.top += 10;
          }

          const dto = DTOConverter.ConvertToDTO(element);
          const cmd = CommandFactory.CreateAddCommand(
            { ...dto, layer, mapId },
            true
          );
          WebSocketManagerInstance.Send(cmd);
        });

        toaster.create({ title: "Pasted", description: "Pasted " + this._clipboard.length + " elements.", type: "success", duration: 5000 });
      }
    },
  },
};
