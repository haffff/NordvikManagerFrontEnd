import { fabric } from "fabric";

export class OnMouseDownSimpleCreateClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if(canvas.simpleCreateMode && canvas.simpleCreateElement)
    {
        //Get create element
        let element = canvas.simpleCreateElement;
        
        //get client rect of battlemap
        let rect = canvas.getElement().getBoundingClientRect();

        //Create object
        fabric.util.enlivenObjects([element], function([object]) {
            object.set({
                left: opt.e.offsetX - rect.left,
                top: opt.e.offsetY - rect.top,
            });
            canvas.add(object);
            canvas.previewObject = object;
            canvas.requestRenderAll();
        });
    }
  }
}
