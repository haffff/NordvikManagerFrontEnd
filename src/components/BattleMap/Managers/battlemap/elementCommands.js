import { ActiveTransportManager as WebSocketManagerInstance, ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import CommandFactory from "../../Factories/CommandFactory";
import { fabric } from "fabric";
import { selectAll } from "../../Helpers/MapSelection";
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

// The map's own fields on its objects (see LoadCanvas's toObject): kept in a copy.
const COPIED_FIELDS = [
  'id', 'name', 'text', 'radius', 'tokenUiElements', 'tokenData', 'isTokenUI', 'isToken', 'cardId', 'parentId',
  'originalLeft', 'originalTop', 'fontSize', 'previewId', 'playerId', 'resourceId', 'resourceKey',
];

// A picture is saved by its resource, not its loaded src (a blob: URL of this page), at any depth.
function withoutLoadedSources(object) {
  if (object.resourceId || object.resourceKey || object.isToken) delete object.src;
  object.objects?.forEach(withoutLoadedSources);
}

// The original's properties as new ones (the server gives them the new element).
const newProperties = (properties) => (Array.isArray(properties) ? properties : [])
  // eslint-disable-next-line no-unused-vars
  .map(({ id, parentID, parentId, entityName, ...property }) => property);

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

    // A snapshot of each element as it's saved: fabric's own serialization with the map's
    // own fields (a token's picture, bars and card, a group's parts included), taken now so a
    // later change to the original isn't pasted; and its properties, which live on the server
    // (a Basics token's bars, a card's values), fetched now.
    CopyElements() {
      const objects = this._BMQueryService.GetSelectedObjects();
      // Out of the selection first: inside one, positions are relative to it.
      this._canvas.discardActiveObject();
      const copies = objects.map((element) => ({
        object: JSON.parse(JSON.stringify(element.toObject(COPIED_FIELDS))),
        properties: element.id
          ? Promise.resolve(WebHelper.getAsync(`properties/QueryProperties?parentIds=${encodeURIComponent(element.id)}`)).catch(() => [])
          : Promise.resolve([]),
      }));
      this._clipboard = { copies, pasted: 0 };

      var sel = new fabric.ActiveSelection(objects, {
        canvas: this._canvas,
      });

      this._canvas.setActiveObject(sel);

      toaster.create({ title: "Copied", description: "Copied " + objects.length + " elements.", type: "success", duration: 5000 });
    },

    // Each copy becomes a new element (with its properties as new ones) on the selected layer
    // and map: where it's told to, or next to the original, each paste a little further on.
    async PasteElements({ coords, isCommand, x, y }) {
      if (isCommand && !x && !y) {
        return "x and y are required.";
      }
      if (isCommand) {
        coords = { x, y };
      }

      const clipboard = this._clipboard;
      if (!clipboard?.copies?.length) return undefined;
      clipboard.pasted += 1;
      const offset = 10 * clipboard.pasted;

      // Resolve layer and mapId once — not per element
      const layer = this._BMQueryService.GetSelectedLayer();
      const mapId = this._BMQueryService.GetSelectedMapID();
      const properties = await Promise.all(clipboard.copies.map((copy) => copy.properties));

      clipboard.copies.forEach((copy, i) => {
        const object = JSON.parse(JSON.stringify(copy.object));
        delete object.id;
        withoutLoadedSources(object);
        if (coords) {
          object.left = coords.x;
          object.top = coords.y;
        } else {
          object.left += offset;
          object.top += offset;
        }
        const cmd = CommandFactory.CreateAddCommand(
          { object: JSON.stringify(object), layer, mapId, properties: newProperties(properties[i]) },
          true
        );
        WebSocketManagerInstance.Send(cmd);
      });

      toaster.create({ title: "Pasted", description: "Pasted " + clipboard.copies.length + " elements.", type: "success", duration: 5000 });
      return undefined;
    },
  },
};
