export class OnPropertyUpdateBehavior {
    Handle(response, canvas) {
        let obj = canvas.getObjects().find(x => x.id === response.data.parentID);
        if (obj) {
            let index = obj.properties.findIndex(x => x.id === response.data.id);
            if (index !== -1) {
                obj.properties[response.data.name] = response.data;
            }
        }
    }
}