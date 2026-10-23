import ClientMediator from "../../../../../ClientMediator";
import { applyAreaUpdate } from "../../../Helpers/buildArea";
import { glowTokensIn, remoteGlowKey } from "../../../Helpers/areaGlow";

export class OnPreviewUpdateBehavior {
  currentPlayer = null;

  async Handle(response, canvas, battleMapId) {
    if (this.currentPlayer === null) {
      this.currentPlayer = await ClientMediator.sendCommandAsync(
        "Game",
        "GetCurrentPlayer"
      );
    }

    const updates = response.data;
    if (updates && response.battleMapId === battleMapId && this.currentPlayer.id !== response.playerId) {
      updates.forEach(({ glow, ...update }) => {
        // Measuring or aiming with "Highlight tokens": the tokens it covers glow here too.
        if (glow !== undefined)
          glowTokensIn(canvas, glow?.area ?? null, glow?.color, remoteGlowKey(response.playerId), glow?.exceptId);

        //Find object by previewId
        const obj = canvas
          .getObjects()
          .find((o) => o.previewId === update.previewId);
        if (!obj) {
          return;
        }
        // An area being aimed may turn: its polygon's box is worked out again.
        applyAreaUpdate(obj, update);
      });
      canvas.requestRenderAll();
    }
    canvas.requestRenderAll();
  }
}
