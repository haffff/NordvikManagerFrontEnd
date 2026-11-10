import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fabric } from "fabric";
import "./CanvasWindow";

// A real Fabric canvas living in another document, the way a popped-out battlemap does.
// Events go to the real DOM nodes, so what's under test is which document Fabric listens on.
let popup;
let canvas;

const noDrawing = new Proxy({}, { get: (_, name) => (name === "canvas" ? undefined : () => undefined), set: () => true });

const rect = (left, top = 10) => {
  const r = new fabric.Rect({ left, top, width: 20, height: 20, strokeWidth: 0 });
  canvas.add(r);
  return r;
};

const fire = (target, type, x, y) =>
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }));

const makeCanvasIn = (doc) => {
  const el = document.createElement("canvas");
  doc.body.appendChild(el);
  return new fabric.Canvas(el, { width: 400, height: 200, renderOnAddRemove: false });
};

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(noDrawing);
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  popup = iframe.contentWindow;
  canvas = makeCanvasIn(popup.document);
});

afterEach(() => {
  canvas.dispose();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("a canvas in a popped-out window", () => {
  it("selects an area dragged over it", () => {
    const [a, b] = [rect(10), rect(60)];
    const el = canvas.upperCanvasEl;

    fire(el, "mousedown", 5, 5);
    fire(el, "mousemove", 100, 40);
    fire(el, "mouseup", 100, 40);

    expect(canvas.getActiveObjects()).toEqual([a, b]);
  });

  it("moves what's dragged", () => {
    const a = rect(10);
    const el = canvas.upperCanvasEl;

    fire(el, "mousedown", 20, 20);
    fire(el, "mouseup", 20, 20);
    fire(el, "mousedown", 20, 20);
    fire(el, "mousemove", 120, 60);
    fire(el, "mouseup", 120, 60);

    expect(a.left).toBe(110);
    expect(a.top).toBe(50);
  });

  it("finishes a drag released outside the canvas", () => {
    const [a, b] = [rect(10), rect(60)];

    fire(canvas.upperCanvasEl, "mousedown", 5, 5);
    fire(popup.document.body, "mousemove", 100, 40);
    fire(popup.document.body, "mouseup", 100, 40);

    expect(canvas.getActiveObjects()).toEqual([a, b]);
  });

  it("still follows the mouse after a click", () => {
    const moves = vi.fn();
    canvas.on("mouse:move", moves);
    const el = canvas.upperCanvasEl;

    fire(el, "mousedown", 20, 20);
    fire(el, "mouseup", 20, 20);
    fire(el, "mousemove", 30, 30);

    expect(moves).toHaveBeenCalledTimes(1);
  });

  it("draws on its own window's frames, which run while the main window is hidden", () => {
    popup.requestAnimationFrame = vi.fn(() => 7);
    popup.cancelAnimationFrame = vi.fn();
    const mainFrames = vi.spyOn(window, "requestAnimationFrame");

    canvas.requestRenderAll();
    canvas.cancelRequestedRender();

    expect(popup.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(popup.cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(mainFrames).not.toHaveBeenCalled();
  });
});

describe("a canvas in the main window", () => {
  it("keeps working as before", () => {
    canvas.dispose();
    canvas = makeCanvasIn(document);
    const [a, b] = [rect(10), rect(60)];
    const el = canvas.upperCanvasEl;

    fire(el, "mousedown", 5, 5);
    fire(el, "mousemove", 100, 40);
    fire(el, "mouseup", 100, 40);

    expect(canvas.getActiveObjects()).toEqual([a, b]);
    expect(fabric.document).toBe(document);
  });
});
