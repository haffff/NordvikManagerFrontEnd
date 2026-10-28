// Takes the user guide's screenshots from the demo (the mock game in src/demo/mockGame.js),
// so they can be retaken the same way whenever the UI changes.
//
//   pnpm start_demo                     (in another terminal; note the port)
//   pnpm docs:shots --url http://localhost:3003 --out ../NordvikManager-Central/docs-site/static/img/user-guide
//   pnpm docs:shots --url ... --out ... --only chat,cards-panel
//
// Uses the Microsoft Edge installed on this computer (playwright-core with channel "msedge"),
// so no browser download is needed. Each shot starts from a fresh page.

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const VIEWPORT = { width: 1600, height: 900 };
const LOAD_MS = 7000;   // the game loads and lays out its windows
const STEP_MS = 1500;   // after a click, for the window or menu to open
const TAB_HEIGHT = 30;  // a window's title tab sits just above its panel

// ── steps ───────────────────────────────────────────────────────────────────

const wait = (page, ms = STEP_MS) => page.waitForTimeout(ms);

/** Opens a top menu, optionally hovers a submenu, and clicks an item. */
async function menu(page, name, item, submenu) {
  await page.getByRole('button', { name, exact: true }).first().click();
  await wait(page, 400);
  if (submenu) {
    await page.getByText(submenu, { exact: true }).last().hover();
    await wait(page, 400);
  }
  if (item) {
    await page.getByText(item, { exact: true }).last().click();
    await wait(page);
  }
}

const clickText = async (page, text) => { await page.getByText(text, { exact: true }).first().click(); await wait(page); };

/**
 * Moves a floating window (found by its panel's PanelList key) to a spot and gives it a
 * size, by dragging its title tab and then its bottom-right corner, as a person would.
 */
async function placeWindow(page, panelKey, { x = 260, y = 70, width = 760, height = 560 } = {}) {
  const panel = visiblePanel(page, panelKey);
  let box = await panel.boundingBox();
  // Grab the empty part of the title bar (a tab would be dragged out on its own).
  const grab = { x: box.x + box.width * 0.55, y: box.y - TAB_HEIGHT / 2 };
  await drag(page, grab, { x: grab.x + (x - box.x), y: grab.y + (y + TAB_HEIGHT - box.y) });
  box = await panel.boundingBox();
  // The resize handle is just inside the bottom-right corner.
  await drag(page, { x: box.x + box.width - 2, y: box.y + box.height - 2 }, { x: x + width, y: y + TAB_HEIGHT + height });
  await wait(page, 800);
}

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** Opens a folder in a list (folders open on double-click). */
const openFolder = async (page, name) => { await page.getByText(name, { exact: true }).first().dblclick(); await wait(page, 800); };

/** Opens a window from a menu and places it (see placeWindow). */
async function openWindow(page, panelKey, menuArgs, size) {
  await menu(page, ...menuArgs);
  await placeWindow(page, panelKey, size);
}

// ── where to crop ───────────────────────────────────────────────────────────


/** A panel on screen, by its PanelList key; the newest if there are several (a just-opened window). */
const visiblePanel = (page, panelKey) => page.locator(`.nm_basePanel[data-panel="${panelKey}"]:visible`).last();

/** The window holding a panel (by its PanelList key), title tab included. */
async function panelClip(page, panelKey) {
  const box = await visiblePanel(page, panelKey).boundingBox();
  if (!box) throw new Error(`panel ${panelKey} is not on screen`);
  return pad({ x: box.x, y: box.y - TAB_HEIGHT, width: box.width, height: box.height + TAB_HEIGHT });
}

function pad(box, by = 4) {
  const x = Math.max(0, box.x - by);
  const y = Math.max(0, box.y - by);
  return {
    x, y,
    width: Math.min(VIEWPORT.width - x, box.width + 2 * by),
    height: Math.min(VIEWPORT.height - y, box.height + 2 * by),
  };
}

// ── the shots ───────────────────────────────────────────────────────────────
// name: the file (<name>.png); role: 'gm' or 'player'; steps: what to do first;
// clip: what to keep (a function of the page, or nothing for the whole window).

export const SHOTS = [
  { name: 'the-game-screen', role: 'gm' },
  { name: 'battle-map', role: 'gm', clip: (p) => panelClip(p, 'Battlemap') },
  {
    name: 'token-selected', role: 'gm',
    steps: async (p) => { await p.mouse.click(390, 490); await wait(p); },
    clip: async () => ({ x: 240, y: 360, width: 360, height: 260 }),
  },
  {
    name: 'map-settings', role: 'gm',
    steps: async (p) => {
      await p.mouse.click(1000, 780, { button: 'right' }); await wait(p, 600);
      await clickText(p, 'Map Settings');
      await placeWindow(p, 'MapSettingsPanel', { width: 620, height: 620 });
    },
    clip: (p) => panelClip(p, 'MapSettingsPanel'),
  },
  { name: 'chat', role: 'player', clip: (p) => panelClip(p, 'ChatPanel') },
  {
    name: 'cards-panel', role: 'gm',
    steps: async (p) => { await openFolder(p, 'Handouts'); },
    clip: (p) => panelClip(p, 'CardsPanel'),
  },
  {
    name: 'layouts-menu', role: 'gm',
    steps: async (p) => { await menu(p, 'Layouts'); },
    clip: async () => ({ x: 0, y: 0, width: 520, height: 300 }),
  },
  { name: 'layout-manager', role: 'gm', steps: (p) => openWindow(p, 'LayoutsManagerPanel', ['Layouts', 'Layout Manager'], { width: 640, height: 360 }), clip: (p) => panelClip(p, 'LayoutsManagerPanel') },
  {
    name: 'materials', role: 'gm',
    steps: async (p) => {
      await openWindow(p, 'MaterialsPanel', ['View', 'Materials'], { width: 560, height: 600 });
      await openFolder(p, 'Maps'); await openFolder(p, 'Portraits');
    },
    clip: (p) => panelClip(p, 'MaterialsPanel'),
  },
  // As the GM, whose docked tab is Manage Players, so this window is the only Players one.
  { name: 'players', role: 'gm', steps: (p) => openWindow(p, 'PlayersPanel', ['View', 'Players'], { width: 460, height: 220 }), clip: (p) => panelClip(p, 'PlayersPanel') },
  {
    name: 'playlists', role: 'gm',
    steps: async (p) => { await openWindow(p, 'PlaylistsPanel', ['View', 'Playlists']); await openFolder(p, 'Music'); },
    clip: (p) => panelClip(p, 'PlaylistsPanel'),
  },
  {
    name: 'game-settings', role: 'gm',
    steps: async (p) => { await openWindow(p, 'GameSettingsPanel', ['Settings', 'Game'], { width: 760, height: 600 }); await clickText(p, 'General Settings'); },
    clip: (p) => panelClip(p, 'GameSettingsPanel'),
  },
  {
    // Browse with an addon picked: the list (category badges), and its details and readme.
    name: 'addons-manage', role: 'gm',
    steps: async (p) => {
      await openWindow(p, 'AddonsManagePanel', ['Addons', 'Addons Manage', 'Addons'], { width: 1000, height: 600 });
      await clickText(p, 'Fifth Edition (SRD)');
    },
    clip: (p) => panelClip(p, 'AddonsManagePanel'),
  },
  {
    name: 'actions-editor', role: 'gm',
    steps: async (p) => {
      await openWindow(p, 'ActionsPanel', ['Addons', 'Actions', 'Code'], { width: 1000, height: 640 });
      await clickText(p, 'perception_check');
    },
    clip: (p) => panelClip(p, 'ActionsPanel'),
  },
];

// ── running ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url || !args.out) {
    console.error('Usage: docs:shots --url <demo url> --out <folder> [--only name,name]');
    process.exit(1);
  }
  const only = args.only ? new Set(String(args.only).split(',')) : null;
  const out = resolve(args.out);
  mkdirSync(out, { recursive: true });

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  let failed = 0;
  try {
    for (const shot of SHOTS.filter((s) => !only || only.has(s.name))) {
      const page = await browser.newPage({ viewport: VIEWPORT });
      try {
        const url = new URL(args.url);
        if (shot.role === 'player') url.searchParams.set('role', 'player');
        await page.goto(url.toString());
        await wait(page, LOAD_MS);
        await page.addStyleTag({ content: '.nm_demoBanner { display: none !important; }' });
        if (shot.steps) await shot.steps(page);
        const clip = shot.clip ? await shot.clip(page) : undefined;
        const file = join(out, `${shot.name}.png`);
        await page.screenshot({ path: file, clip });
        console.log(`✓ ${shot.name}`);
      } catch (e) {
        failed++;
        console.error(`✗ ${shot.name}: ${e.message.split('\n')[0]}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
}

main();
