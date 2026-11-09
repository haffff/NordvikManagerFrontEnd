import { fabric } from "fabric";

// Fabric keeps one document and one window: the main ones. A battlemap popped out into
// its own browser window lives in another document, where that goes wrong in two ways.
// On press Fabric moves its move and release listeners to fabric.document, so they never
// hear the pop-out's mouse and the drag never ends. And it draws on the main window's
// animation frames, which stop when that window is covered or minimized.
const proto = fabric.Canvas.prototype;

const ownDocument = (canvas) => canvas.upperCanvasEl?.ownerDocument ?? fabric.document;
const ownWindow = (canvas) => ownDocument(canvas).defaultView ?? fabric.window;

// These add or remove the listeners on fabric.document; for the length of the call it's
// the canvas's own document. Patched here because Fabric binds them per canvas when it's
// created.
["_onMouseDown", "_onMouseUp", "_onTouchStart", "_onTouchEnd", "removeListeners"].forEach((name) => {
  const original = proto[name];
  proto[name] = function (...args) {
    const main = fabric.document;
    fabric.document = ownDocument(this);
    try {
      return original.apply(this, args);
    } finally {
      fabric.document = main;
    }
  };
});

const { requestRenderAll, cancelRequestedRender } = proto;

proto.requestRenderAll = function () {
  const win = ownWindow(this);
  if (win === fabric.window) return requestRenderAll.call(this);
  if (!this.isRendering) this.isRendering = win.requestAnimationFrame(this.renderAndResetBound);
  return this;
};

proto.cancelRequestedRender = function () {
  const win = ownWindow(this);
  if (win === fabric.window) return cancelRequestedRender.call(this);
  if (this.isRendering) {
    win.cancelAnimationFrame(this.isRendering);
    this.isRendering = 0;
  }
};
