import { fabric } from 'fabric';

/**
 * fabric.Cone — extends fabric.Line so that (x1,y1) is the apex and
 * (x2,y2) is the direction/range endpoint, just like fabric.LineArrow.
 * Renders a filled triangle (cone) spreading from the apex.
 * coneAngle (degrees, default 53) controls the spread width.
 * objectCaching is disabled so the shape clips correctly when it extends
 * beyond the line bounding box.
 */
const ConeTypeInit = () => {
    if (fabric.Cone) {
        return;
    }

    fabric.Cone = fabric.util.createClass(fabric.Line, {

        type: 'cone',

        initialize: function (element, options) {
            options = options || {};
            this.callSuper('initialize', element, options);
            this.coneAngle = options.coneAngle ?? 53; // spread in degrees
            this.objectCaching = false;
        },

        toObject: function () {
            return fabric.util.object.extend(this.callSuper('toObject'), {
                coneAngle: this.coneAngle,
            });
        },

        _render: function (ctx) {
            const dx = this.x2 - this.x1;
            const dy = this.y2 - this.y1;
            const length = Math.sqrt(dx * dx + dy * dy);

            if (length < 1) return;

            const dir = Math.atan2(dy, dx);
            const half = (this.coneAngle * Math.PI / 180) / 2;

            // fabric.Line centers the rendering context at the midpoint of (x1,y1)-(x2,y2).
            // Apex in local coords is therefore at (-dx/2, -dy/2).
            const apexX = -dx / 2;
            const apexY = -dy / 2;

            // Left and right base vertices in local coords
            const leftX = apexX + length * Math.cos(dir - half);
            const leftY = apexY + length * Math.sin(dir - half);
            const rightX = apexX + length * Math.cos(dir + half);
            const rightY = apexY + length * Math.sin(dir + half);

            ctx.save();

            ctx.beginPath();
            ctx.moveTo(apexX, apexY);
            ctx.lineTo(leftX, leftY);
            ctx.lineTo(rightX, rightY);
            ctx.closePath();

            ctx.fillStyle = this.fill || 'rgba(255,255,255,0.15)';
            ctx.fill();

            ctx.strokeStyle = this.stroke || '#000';
            ctx.lineWidth = this.strokeWidth || 2;
            ctx.stroke();

            ctx.restore();
        },
    });

    fabric.Cone.fromObject = function (object, callback) {
        callback && callback(new fabric.Cone(
            [object.x1, object.y1, object.x2, object.y2],
            object
        ));
    };

    fabric.Cone.async = true;
};

export default ConeTypeInit;
