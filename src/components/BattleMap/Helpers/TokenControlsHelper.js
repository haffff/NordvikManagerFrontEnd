// Hides/shows a token's resize+rotate handles to match its lock state.
// fabric.js's lockScalingX/lockScalingY/lockRotation only block the interaction —
// they don't touch handle visibility on their own, so without this the (now
// non-functional) handles stay visible after locking, which is confusing.
export function syncControlsVisibility(obj) {
  if (!obj || typeof obj.setControlsVisibility !== "function") return;
  const locked = !!(obj.lockScalingX || obj.lockScalingY || obj.lockRotation);
  obj.setControlsVisibility({
    tl: !locked, tr: !locked, bl: !locked, br: !locked,
    ml: !locked, mr: !locked, mt: !locked, mb: !locked,
    mtr: !locked,
  });
}

export default syncControlsVisibility;
