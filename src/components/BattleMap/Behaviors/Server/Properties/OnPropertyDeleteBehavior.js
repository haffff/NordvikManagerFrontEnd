export class OnPropertyDeleteBehavior {
    Handle(response, canvas) {
        let obj = canvas.getObjects().find(x => x.id === response.data.parentId);
        if (obj) {
            let index = obj.properties.findIndex(x => x.id === response.data.id);
            if (index !== -1) {
                let prop = Object.keys(obj.properties).find(x=>x.id === response.data.id);
                delete obj.properties[prop.name];
            }
        }
    }
}