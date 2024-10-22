export class OnPropertyAddBehavior {
    Handle(response, canvas) {
        let obj = canvas.getObjects().find(x => x.id === response.data.parentId);
        if (obj) {
            obj.properties[response.data.name] = response.data;
        }
    }
}