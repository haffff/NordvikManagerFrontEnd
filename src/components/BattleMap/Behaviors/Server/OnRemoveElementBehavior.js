export class OnRemoveElementBehavior {
  Handle(response, canvas) {
    let obj = canvas.getObjects().filter(x => x.id === response.data.id);
    if (obj) {
      obj[0]?.additionalObjects?.forEach(element => {
        canvas.remove(element);
      });
      canvas.remove(obj[0]);
    }
    canvas.requestRenderAll();
  }
}