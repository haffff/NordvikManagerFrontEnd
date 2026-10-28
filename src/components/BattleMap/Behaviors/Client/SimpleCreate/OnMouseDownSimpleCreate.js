import { fabric } from "fabric";
import { sizingKind } from "./sizing";

export class OnMouseDownSimpleCreateClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.simpleCreateMode && canvas.simpleCreateElement) {
      // Prevent duplicate previews if enlivenObjects callback hasn't fired yet
      if (canvas.previewObject || canvas.previewSpawning) return;
      canvas.previewSpawning = true;

      //Get create element
      let element = canvas.simpleCreateElement;

      //get client rect of battlemap
      let canvasCoords = canvas.getPointerWithAlign(opt);

      // Store the anchor point so OnMouseMove can compute absolute dimensions
      canvas.previewAnchorX = canvasCoords.x;
      canvas.previewAnchorY = canvasCoords.y;

      //Create object
      fabric.util.enlivenObjects([element], function ([object]) {
        canvas.previewSpawning = false;
        object.set({
          left: canvasCoords.x,
          top: canvasCoords.y,
          selectable: false,
        });

        // A circle grows from the pressed point, so it starts as a dot centred there.
        if (sizingKind(canvas.withSizing) === "radius") {
          object.set({ originX: "center", originY: "center", radius: 0 });
        }

        canvas.add(object);
        canvas.previewObject = object;
        canvas.requestRenderAll();
      });
    }
  }
}
