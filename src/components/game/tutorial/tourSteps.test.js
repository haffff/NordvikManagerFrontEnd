import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PLAYER_TOUR_STEPS,
  TOUR_STORAGE_KEY,
  visibleSteps,
  hasSeenTour,
  markTourSeen,
  shouldStartTour,
  startPlayerTour,
} from './tourSteps';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
};
const brokenStorage = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
};

describe('player tour steps', () => {
  it('starts with a welcome and ends with a pointer to the Player guide, both without a target', () => {
    expect(PLAYER_TOUR_STEPS[0].target).toBeUndefined();
    const last = PLAYER_TOUR_STEPS[PLAYER_TOUR_STEPS.length - 1];
    expect(last.target).toBeUndefined();
    expect(last.text).toMatch(/nordvikmanager\.pl\/user-guide/);
  });

  it('every other step points at a panel or a data-tour target', () => {
    for (const step of PLAYER_TOUR_STEPS.slice(1, -1)) {
      expect(step.target).toMatch(/^(\.nm_basePanel\[data-panel="[A-Za-z]+"\]|\[data-tour="[a-z-]+"\])$/);
      expect(step.title).toBeTruthy();
      expect(step.text).toBeTruthy();
    }
  });
});

describe('step targets exist in the app', () => {
  it('every panel step names a panel in PanelList (BasePanel writes that key into data-panel)', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../helpers/PanelsList.js'), 'utf8');
    const listBody = source.slice(source.indexOf('export const PanelList'), source.indexOf('}', source.indexOf('export const PanelList')));
    const keys = new Set([...listBody.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]));
    const used = PLAYER_TOUR_STEPS.map((s) => s.target?.match(/data-panel="(\w+)"/)?.[1]).filter(Boolean);
    expect(used.length).toBeGreaterThan(0);
    for (const key of used) expect(keys.has(key), key).toBe(true);
  });

  it('every data-tour step names an attribute the app renders (menus: data-tour="menu-<viewId>")', () => {
    const srcDir = path.resolve(__dirname, '../../..');
    const sources = fs.readdirSync(srcDir, { recursive: true })
      .filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\./.test(f) && !f.includes('tutorial'))
      .map((f) => fs.readFileSync(path.join(srcDir, f), 'utf8'))
      .join('\n');
    const names = PLAYER_TOUR_STEPS.map((s) => s.target?.match(/data-tour="([a-z-]+)"/)?.[1]).filter(Boolean);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const found = name.startsWith('menu-')
        ? sources.includes(`viewId={"${name.slice(5)}"}`)
        : sources.includes(`data-tour="${name}"`);
      expect(found, name).toBe(true);
    }
  });
});

describe('visibleSteps', () => {
  const doc = document.implementation.createHTMLDocument('t');
  doc.body.innerHTML = '<div data-tour="chat"></div><div data-tour="cards"></div>';
  const steps = [
    { title: 'Welcome', text: 'hi' },
    { target: '[data-tour="chat"]', title: 'Chat', text: 'c' },
    { target: '[data-tour="turn-order"]', title: 'Turn order', text: 't' },
    { target: '[data-tour="cards"]', title: 'Cards', text: 'k' },
  ];

  it('keeps steps without a target and drops those whose target is missing', () => {
    const result = visibleSteps(steps, doc, () => true);
    expect(result.map((s) => s.title)).toEqual(['Welcome', 'Chat', 'Cards']);
  });

  it('drops steps whose target is on the page but not shown (e.g. a background tab)', () => {
    const isVisible = (el) => el.getAttribute('data-tour') !== 'cards';
    expect(visibleSteps(steps, doc, isVisible).map((s) => s.title)).toEqual(['Welcome', 'Chat']);
  });

  it('hands the element on, so the tour highlights exactly what was checked', () => {
    const chat = visibleSteps(steps, doc, () => true)[1];
    expect(chat.element).toBe(doc.querySelector('[data-tour="chat"]'));
  });
});

describe('seen flag', () => {
  it('is per browser, under a versioned key', () => {
    expect(TOUR_STORAGE_KEY).toBe('nm_tour_player_v1');
    const storage = memoryStorage();
    expect(hasSeenTour(storage)).toBe(false);
    markTourSeen(storage);
    expect(hasSeenTour(storage)).toBe(true);
  });

  it('never throws when storage is blocked', () => {
    expect(() => markTourSeen(brokenStorage)).not.toThrow();
    expect(hasSeenTour(brokenStorage)).toBe(false);
    expect(hasSeenTour(undefined)).toBe(false);
  });
});

describe('shouldStartTour', () => {
  it('starts for a player who has not seen it', () => {
    expect(shouldStartTour({ isGM: false, storage: memoryStorage() })).toBe(true);
  });

  it('does not start for the GM or after it was seen', () => {
    expect(shouldStartTour({ isGM: true, storage: memoryStorage() })).toBe(false);
    expect(shouldStartTour({ isGM: false, storage: memoryStorage({ [TOUR_STORAGE_KEY]: '1' }) })).toBe(false);
  });
});

describe('startPlayerTour', () => {
  const doc = document.implementation.createHTMLDocument('t');
  doc.body.innerHTML = '<div data-tour="chat"></div>';
  const steps = [
    { title: 'Welcome', text: 'hi' },
    { target: '[data-tour="chat"]', title: 'Chat', text: 'c' },
    { target: '[data-tour="missing"]', title: 'Missing', text: 'm' },
  ];

  it('drives the visible steps and marks the tour seen when it ends (finished or skipped)', () => {
    const drive = vi.fn();
    let config;
    const driverFactory = vi.fn((c) => { config = c; return { drive }; });
    const storage = memoryStorage();

    startPlayerTour({ steps, doc, storage, driverFactory, isVisible: () => true });

    expect(drive).toHaveBeenCalledTimes(1);
    expect(config.popoverClass).toBe('nm_tour');
    expect(config.showProgress).toBe(true);
    expect(config.steps).toEqual([
      { popover: { title: 'Welcome', description: 'hi' } },
      { element: doc.querySelector('[data-tour="chat"]'), popover: { title: 'Chat', description: 'c' } },
    ]);
    expect(hasSeenTour(storage)).toBe(false);
    config.onDestroyed();
    expect(hasSeenTour(storage)).toBe(true);
  });

  it('does nothing when no step can be shown', () => {
    const driverFactory = vi.fn();
    const result = startPlayerTour({ steps: [steps[2]], doc, storage: memoryStorage(), driverFactory, isVisible: () => true });
    expect(result).toBeNull();
    expect(driverFactory).not.toHaveBeenCalled();
  });
});
