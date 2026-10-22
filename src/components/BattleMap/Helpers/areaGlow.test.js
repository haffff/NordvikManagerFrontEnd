import { describe, it, expect } from "vitest";
import { glowTokensIn } from "./areaGlow";

// Tokens an area covers light up (aiming with RequestPoint, measuring), by the area rule;
// the rest, and token parts, keep their own look.
describe("glowTokensIn", () => {
  const token = (name, x, extra = {}) => ({
    name, tokenData: {}, shadow: "own", ...extra,
    getCenterPoint: () => ({ x, y: 0 }), getScaledWidth: () => 50, getScaledHeight: () => 50,
    set(props) { Object.assign(this, props); },
  });
  const canvasOf = (objects) => ({ getObjects: () => objects });
  const circle = { shape: "circle", x: 0, y: 0, radius: 100 };

  it("lights up the covered tokens and keeps their own shadow for later", () => {
    const near = token("near", 120), far = token("far", 300);
    glowTokensIn(canvasOf([near, far]), circle, "rgba(1,2,3,0.95)", "beforeMeasureShadow");

    expect(near.shadow.color).toBe("rgba(1,2,3,0.95)");
    expect(near.beforeMeasureShadow).toBe("own");
    expect(far.shadow).toBe("own");
  });

  it("puts them back when the area moves away or is gone", () => {
    const near = token("near", 120);
    glowTokensIn(canvasOf([near]), circle, "red", "k");
    glowTokensIn(canvasOf([near]), null, "red", "k");

    expect(near.shadow).toBe("own");
    expect(near.k).toBeUndefined();
  });

  it("leaves token parts and previews alone", () => {
    const bar = token("bar", 0, { isTokenUI: true }), preview = token("p", 0, { preview: true });
    glowTokensIn(canvasOf([bar, preview]), circle, "red", "k");

    expect([bar.shadow, preview.shadow]).toEqual(["own", "own"]);
  });
});
