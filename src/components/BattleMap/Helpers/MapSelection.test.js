import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fabric } from "fabric";
import { installMapSelection, selectAll } from "./MapSelection";
import { installLayerTargeting, setLayerView } from "./LayerTargeting";

// A real Fabric canvas, pressed and released through its own mouse handling: what's
// under test is how the selection rules fit Fabric's.
let canvas;

// jsdom draws nothing; hit testing and selecting don't need it to.
const noDrawing = new Proxy({}, { get: (_, name) => (name === "canvas" ? undefined : () => undefined), set: () => true });

const rect = (left, top = 10, props = {}) => {
  const r = new fabric.Rect({ left, top, width: 20, height: 20, strokeWidth: 0, layer: 1, ...props });
  canvas.add(r);
  return r;
};

const mouse = (type, x, y, keys = {}) => {
  const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, ...keys });
  if (type === "mousedown") canvas._onMouseDown(e);
  else if (type === "mousemove") canvas._onMouseMove(e);
  else canvas._onMouseUp(e);
};

const click = (x, y, keys) => {
  mouse("mousedown", x, y, keys);
  mouse("mouseup", x, y, keys);
};

const drag = (from, to, keys) => {
  mouse("mousedown", from[0], from[1], keys);
  mouse("mousemove", to[0], to[1], keys);
  mouse("mouseup", to[0], to[1], keys);
};

const selected = () => canvas.getActiveObjects();

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(noDrawing);
  const el = document.createElement("canvas");
  el.width = 400;
  el.height = 200;
  document.body.appendChild(el);
  canvas = new fabric.Canvas(el, { width: 400, height: 200, renderOnAddRemove: false });
  canvas.selectedLayer = 1;
  installLayerTargeting(canvas);
  installMapSelection(canvas);
});

afterEach(() => {
  canvas.dispose();
  vi.restoreAllMocks();
});

describe("clicking with a modifier", () => {
  it.each([["ctrlKey"], ["metaKey"], ["shiftKey"]])("%s adds to the selection", (key) => {
    const [a, b] = [rect(10), rect(60)];

    click(20, 20);
    click(70, 20, { [key]: true });

    expect(selected()).toEqual(expect.arrayContaining([a, b]));
    expect(selected()).toHaveLength(2);
  });

  it("Ctrl+click takes one out of the selection again", () => {
    const [a, b, c] = [rect(10), rect(60), rect(110)];
    click(20, 20);
    click(70, 20, { ctrlKey: true });
    click(120, 20, { ctrlKey: true });

    click(70, 20, { ctrlKey: true });

    expect(selected()).toEqual(expect.arrayContaining([a, c]));
    expect(selected()).not.toContain(b);
  });

  it("a plain click replaces the selection", () => {
    const [, b] = [rect(10), rect(60)];
    click(20, 20);

    click(70, 20);

    expect(selected()).toEqual([b]);
  });

  it("a modifier click on the empty map keeps the selection", () => {
    const a = rect(10);
    click(20, 20);

    click(300, 150, { ctrlKey: true });

    expect(selected()).toEqual([a]);
  });

  it("a plain click on the empty map clears the selection", () => {
    rect(10);
    click(20, 20);

    click(300, 150);

    expect(selected()).toEqual([]);
  });
});

describe("resizing with Ctrl held (the default key for snapping a resize)", () => {
  // Bottom-right corner handle of what's selected.
  const corner = (obj) => {
    obj.setCoords();
    return [obj.oCoords.br.x, obj.oCoords.br.y];
  };

  it("resizes the one element selected, and leaves it selected", () => {
    const a = rect(10);
    click(20, 20);
    const [x, y] = corner(a);

    drag([x, y], [x + 30, y + 30], { ctrlKey: true });

    expect(a.scaleX).toBeGreaterThan(1);
    expect(selected()).toEqual([a]);
  });

  it("keeps a multi-selection whole", () => {
    const [a, b] = [rect(10), rect(60)];
    click(20, 20);
    click(70, 20, { ctrlKey: true });
    const [x, y] = corner(canvas.getActiveObject());

    drag([x, y], [x + 30, y + 30], { ctrlKey: true });

    expect(selected()).toEqual([a, b]);
  });
});

describe("dragging an area", () => {
  it("without a modifier selects what's in it, instead of what was selected", () => {
    rect(10);
    const [b, c] = [rect(60), rect(110)];
    click(20, 20);

    drag([55, 5], [135, 35]);

    expect(selected()).toEqual(expect.arrayContaining([b, c]));
    expect(selected()).toHaveLength(2);
  });

  it("with Shift adds what's in it to the selection", () => {
    const [a, b, c] = [rect(10), rect(60), rect(110)];
    click(20, 20);

    drag([55, 5], [135, 35], { shiftKey: true });

    expect(selected()).toEqual([a, b, c]);
  });

  it("with Shift keeps the selection, released before the mouse button or not", () => {
    const [a, b] = [rect(10), rect(60)];
    click(20, 20);

    mouse("mousedown", 55, 5, { shiftKey: true });
    mouse("mousemove", 85, 35, { shiftKey: true });
    mouse("mouseup", 85, 35);

    expect(selected()).toEqual([a, b]);
  });

  it("with Shift adds to a multi-selection, each once", () => {
    const [a, b, c] = [rect(10), rect(60), rect(110)];
    click(20, 20);
    click(70, 20, { ctrlKey: true });

    drag([55, 5], [135, 35], { shiftKey: true });

    expect(selected()).toEqual([a, b, c]);
  });

  it("with Shift doesn't take in what can't be selected", () => {
    const a = rect(10);
    rect(60, 10, { selectable: false });
    click(20, 20);

    drag([55, 5], [85, 35], { shiftKey: true });

    expect(selected()).toEqual([a]);
  });

  it("with Shift still starts when pressed on something that can't be selected", () => {
    const a = rect(10);
    const seen = rect(60, 10, { selectable: false });
    const b = rect(110);
    click(20, 20);

    drag([70, 20], [125, 25], { shiftKey: true });

    expect(selected()).toEqual([a, b]);
    expect(selected()).not.toContain(seen);
  });
});

describe("selectAll", () => {
  it("selects everything that can be selected", () => {
    const [a, b] = [rect(10), rect(60)];

    selectAll(canvas);

    expect(selected()).toEqual([a, b]);
  });

  it("leaves out what can't be selected or isn't drawn", () => {
    const a = rect(10);
    rect(60, 10, { selectable: false });
    rect(110, 10, { visible: false });
    rect(160, 10, { evented: false });

    selectAll(canvas);

    expect(selected()).toEqual([a]);
  });

  it("leaves out layers this canvas hides", () => {
    const a = rect(10);
    rect(60, 10, { layer: 7, selectable: true });
    setLayerView(canvas, { hidden: new Set([7]), dimmed: new Set() });

    selectAll(canvas);

    expect(selected()).toEqual([a]);
  });

  it("works with a selection already there", () => {
    const [a, b, c] = [rect(10), rect(60), rect(110)];
    click(20, 20);
    click(70, 20, { ctrlKey: true });

    selectAll(canvas);

    expect(selected()).toEqual([a, b, c]);
  });

  it("does nothing on an empty map, or while a tool has selecting switched off", () => {
    selectAll(canvas);
    expect(selected()).toEqual([]);

    rect(10);
    canvas.selection = false;
    selectAll(canvas);
    expect(selected()).toEqual([]);
  });
});
