import { fabric } from 'fabric';
import UtilityHelper from '../../../../helpers/UtilityHelper';

export class OnTokenClickedInSelectModeClientBehavior {
    Handle(event, canvas, map, battleMapId) {
        if(!canvas.tokenSelectMode)
        {
            return;
        }

        let token = event.target;
        if (!token || !token.tokenData || token.isTokenUI) {
            return;
        }

        if(canvas.tokens === undefined)
        {
            canvas.tokens = [];
        }

        let tokens = canvas.tokens;

        if(tokens.find(x=>x.id === token.id))
        {
            //deselect token
            token.set("stroke", token.beforeTokenSelectStrokeColor);
            token.set("beforeTokenSelectStrokeColor", undefined);
            token.set("strokeWidth", token.beforeTokenSelectStrokeWidth);
            token.set("beforeTokenSelectStrokeWidth", undefined);
            tokens = tokens.filter(x=>x.id !== token.id);
            canvas.tokens = tokens;
        }
        else
        {
            if(tokens.length >= canvas.maxTokens)
            {
                return;
            }

            //select token
            token.set("beforeTokenSelectStrokeColor", token.stroke);
            token.set("stroke", "rgba(255,0,0,1)");
            token.set("beforeTokenSelectStrokeWidth", token.strokeWidth);
            token.set("strokeWidth", 15);
            tokens.push(token);
        }

        canvas.requestRenderAll();
    }
}