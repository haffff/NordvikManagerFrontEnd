import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installIframePointerGuard, POINTER_HELD_CLASS } from './iframePointerGuard';

describe('installIframePointerGuard', () => {
  let uninstall;
  const held = () => document.body.classList.contains(POINTER_HELD_CLASS);
  const fire = (target, type, init = {}) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }));

  beforeEach(() => { uninstall = installIframePointerGuard(); });
  afterEach(() => { uninstall(); document.body.classList.remove(POINTER_HELD_CLASS); });

  it('marks the page while the left button is held, and clears it on release', () => {
    fire(document.body, 'mousedown', { button: 0 });
    expect(held()).toBe(true);

    fire(document.body, 'mouseup', { button: 0 });
    expect(held()).toBe(false);
  });

  it('ignores other buttons (a right click opens a menu and may never see its mouseup)', () => {
    fire(document.body, 'mousedown', { button: 2 });
    expect(held()).toBe(false);
  });

  it('clears on a native drag-and-drop end, which fires no mouseup', () => {
    fire(document.body, 'mousedown', { button: 0 });
    document.body.dispatchEvent(new Event('dragend', { bubbles: true }));
    expect(held()).toBe(false);
  });

  it('clears when the window loses focus mid-drag', () => {
    fire(document.body, 'mousedown', { button: 0 });
    window.dispatchEvent(new Event('blur'));
    expect(held()).toBe(false);
  });

  it('stops listening once uninstalled', () => {
    uninstall();
    fire(document.body, 'mousedown', { button: 0 });
    expect(held()).toBe(false);
  });
});
