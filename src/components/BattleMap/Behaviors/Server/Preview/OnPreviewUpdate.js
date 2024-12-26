import ClientMediator from "../../../../../ClientMediator";

export class OnPreviewUpdateBehavior {
  Handle(response, canvas, battleMapId) {
    const updates = response.data;
    if (
      updates &&
      !(
        response.battleMapId === battleMapId
      )
    ) {
      updates.forEach((update) => {
        //Find object by previewId
        const obj = canvas
          .getObjects()
          .find((o) => o.previewId === update.previewId);
        if (!obj) {
          return;
        }
        obj.set(update);
      });
      canvas.requestRenderAll();
    }
    canvas.requestRenderAll();
  }
}
