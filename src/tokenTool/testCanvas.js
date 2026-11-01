// Test helpers: jsdom has no canvas backend (the canvas package isn't built), so tests
// get the part of a Fabric canvas TokenManager uses, and a 2D context whose drawing
// calls do nothing and which measures text roughly (Fabric lays text out with it).
import { vi } from "vitest";

export function stubCanvasContext() {
  const context2d = () => new Proxy({ measureText: (t) => ({ width: String(t).length * 6 }) }, {
    get: (target, key) => (key in target ? target[key] : () => {}),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () {
    return (this.__ctx ??= context2d());
  });
}

export function fakeCanvas({ width = 300, height = 300 } = {}) {
  let objects = [];
  const handlers = {};
  return {
    /** Calls the handlers registered for a canvas event, as Fabric would. */
    fire: (name, opt) => (handlers[name] ?? []).forEach((h) => h(opt)),
    getObjects: () => objects,
    add: (...o) => { objects.push(...o); },
    remove: (...o) => { objects = objects.filter((x) => !o.includes(x)); },
    getWidth: () => width,
    getHeight: () => height,
    requestRenderAll: vi.fn(),
    renderAll: vi.fn(),
    on: vi.fn((name, h) => { (handlers[name] ??= []).push(h); }),
    off: vi.fn((name, h) => { handlers[name] = (handlers[name] ?? []).filter((x) => x !== h); }),
  };
}
