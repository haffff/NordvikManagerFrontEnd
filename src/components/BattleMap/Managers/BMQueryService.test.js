import { describe, it, expect, beforeEach } from 'vitest';
import BMQueryService from './BMQueryService';

// A minimal fake canvas that mimics fabric.Canvas's on/off event semantics
// closely enough to reproduce the actual bug: off(eventName) with NO handler
// argument removes EVERY listener for that event, not just the caller's own —
// exactly like the real fabric.Observable.off().
function makeFakeCanvas() {
  const listeners = new Map(); // eventName -> Set<handler>

  return {
    on(eventName, handler) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
    },
    off(eventName, handler) {
      const set = listeners.get(eventName);
      if (!set) return;
      if (handler === undefined) {
        set.clear(); // fabric's real behavior: no handler arg clears everyone
      } else {
        set.delete(handler);
      }
    },
    fire(eventName, event) {
      for (const handler of listeners.get(eventName) ?? []) handler(event);
    },
    listenerCount(eventName) {
      return listeners.get(eventName)?.size ?? 0;
    },
  };
}

// Regression coverage for the H1 fix: LoadBMSubscriptions used to do a blanket
// canvas.off("selection:created") (no handler arg) for keys it manages, which
// also belong to BehaviorDictionaryClient — this wiped out BMQueryService's own
// selection listeners since fabric's off(eventName) with no handler clears every
// listener for that event, not just the caller's own. The fix makes
// BMQueryService.Load() remove ONLY its own handler reference, so it can be
// called a second time (after LoadBMSubscriptions's sweep, in LoadCanvas.js)
// without orphaning itself or anyone else's listener on the same event.
describe('BMQueryService.Load — selection listener lifecycle', () => {
  let canvas;
  let service;

  beforeEach(() => {
    canvas = makeFakeCanvas();
    service = new BMQueryService();
    service._canvas = canvas;
    service._battleMapModel = { id: 'bm-1' };
  });

  it('registers a selection:created/updated/cleared handler', () => {
    service.Load();
    expect(canvas.listenerCount('selection:created')).toBe(1);
    expect(canvas.listenerCount('selection:updated')).toBe(1);
    expect(canvas.listenerCount('selection:cleared')).toBe(1);
  });

  it('fires _onSelectionChanged when the canvas reports a selection change', () => {
    let received;
    service._onSelectionChanged = (e) => { received = e; };
    // Re-load so the handler installed above is the one actually wired up —
    // _onSelectionChanged is looked up dynamically via the arrow-function
    // wrapper, so no need to reassign it a second time.
    service.Load();
    canvas.fire('selection:created', { foo: 'bar' });
    expect(received).toEqual({ foo: 'bar' });
  });

  it('calling Load() a second time does not accumulate duplicate handlers', () => {
    service.Load();
    service.Load();
    expect(canvas.listenerCount('selection:created')).toBe(1);
  });

  it('surviving an external blanket off(eventName) (simulating LoadBMSubscriptions) requires re-calling Load() — this is the documented two-call pattern in LoadCanvas.js', () => {
    service.Load();
    expect(canvas.listenerCount('selection:created')).toBe(1);

    // Simulate LoadBMSubscriptions's blanket sweep for a key it manages that
    // also happens to be "selection:created".
    canvas.off('selection:created');
    expect(canvas.listenerCount('selection:created')).toBe(0);

    // LoadCanvas.js re-calls BMQueryService.Load() after LoadBMSubscriptions —
    // this must restore exactly one handler, not zero and not two.
    service.Load();
    expect(canvas.listenerCount('selection:created')).toBe(1);
  });

  it("does NOT remove another party's handler on the same event when it re-registers its own (targeted removal, not blanket off)", () => {
    // Something else (BehaviorDictionaryClient's own selection handler, via
    // LoadBMSubscriptions) also listens on the same event name.
    const otherPartyHandler = () => {};
    canvas.on('selection:created', otherPartyHandler);

    service.Load();
    expect(canvas.listenerCount('selection:created')).toBe(2); // own + other party

    // Re-loading (e.g. a second LoadCanvas() run) must only remove its OWN
    // previous handler, not the other party's.
    service.Load();
    expect(canvas.listenerCount('selection:created')).toBe(2);
  });
});
