import { fabric } from "fabric";

export class OnMouseDownSimpleCreateClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if(canvas.simpleCreateMode && canvas.simpleCreateElement)
    {
        //Get create element
        let element = canvas.simpleCreateElement;
        
        //get client rect of battlemap
        let rect = canvas.getElement().getBoundingClientRect();
        let canvasCoords = canvas.getPointer(opt);
        //Create object
        fabric.util.enlivenObjects([element], function([object]) {
            object.set({
                left: canvasCoords.x,
                top: canvasCoords.y,
                selectable: false,
            });
            canvas.add(object);
            canvas.previewObject = object;
            canvas.requestRenderAll();
        });
    }
  }
}
