import { fabric } from 'fabric';

const ArrowTypeInit = () => {
    if(fabric.LineArrow)
    {
        return;
    }

    fabric.LineArrow = fabric.util.createClass(fabric.Line, {

        type: 'lineArrow',

        initialize: function (element, options) {
            options || (options = {});
            this.callSuper('initialize', element, options);
        },

        toObject: function () {
            return fabric.util.object.extend(this.callSuper('toObject'));
        },

        _render: function (ctx) {
            this.callSuper('_render', ctx);

            // do not render if width/height are zeros or object is not visible
            if (this.width === 0 || this.height === 0 || !this.visible) return;

            ctx.save();

            var xDiff = this.x2 - this.x1;
            var yDiff = this.y2 - this.y1;
            var angle = Math.atan2(yDiff, xDiff);
            ctx.translate((this.x2 - this.x1) / 2, (this.y2 - this.y1) / 2);
            ctx.rotate(angle);
            ctx.beginPath();
            //move 10px in front of line to start the arrow so it does not have the square line end showing in front (0,0)
            ctx.moveTo(10, 0);
            ctx.lineTo(-20, 15);
            ctx.lineTo(-20, -15);
            ctx.closePath();
            ctx.fillStyle = this.stroke;
            ctx.fill();

            ctx.restore();
        }
    });

    fabric.LineArrow.fromObject = function (object, callback) {
        callback && callback(new fabric.LineArrow([object.x1, object.y1, object.x2, object.y2], object));
    };

    fabric.LineArrow.async = true;
}

export default ArrowTypeInit;