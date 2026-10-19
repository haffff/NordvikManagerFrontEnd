// The first-join tour for players: what is where in the game screen.
//
// Every game has its own layout (the GM's default), so a step points at a panel
// or a [data-tour="…"] element and is left out when that element isn't on screen,
// e.g. a panel the GM didn't put in the layout, or one in a background tab.

/** Bump the version when the tour changes enough that everyone should see it again. */
export const TOUR_STORAGE_KEY = 'nm_tour_player_v1';

const PLAYER_GUIDE_URL = 'https://nordvikmanager.pl/user-guide/';

// Panels: BasePanel marks each one with data-panel="<PanelList key>". Fixed UI: data-tour.
const panel = (key) => `.nm_basePanel[data-panel="${key}"]`;
const tour = (name) => `[data-tour="${name}"]`;

export const PLAYER_TOUR_STEPS = [
  {
    title: 'Welcome to the game',
    text: 'A quick look at what is where. Use the arrow keys or the buttons to move on. You can close this now and replay it any time from Game → Show tutorial.',
  },
  {
    target: panel('Battlemap'),
    title: 'The map',
    text: 'Your GM’s battle map. Scroll to zoom, and drag with the middle mouse button to move around. Drag your token to move it, if the GM gave you control of it. Right-click things on the map for more options.',
  },
  {
    target: panel('ToolsPanel'),
    title: 'Tools',
    text: 'Select things, drag the view, measure distances (line, radius, cone) and sketch quick marks that everyone sees for a moment. Drawing tools show up here when the GM lets you draw.',
  },
  {
    target: panel('ChatPanel'),
    title: 'Chat',
    text: 'Talk to the table. Type /r 1d20+5 to roll dice, /w name text to whisper to one player, or /gm text to message the GM only. /help lists the commands.',
  },
  {
    target: tour('chat-dice'),
    title: 'Dice roller',
    text: 'Not sure about roll commands? Click the die to build a roll by clicking dice. It shows the command it sends, so you can learn it as you go.',
  },
  {
    target: panel('DiceRollerPanel'),
    title: 'Dice panel',
    text: 'The same dice roller as a panel you can keep open next to the map.',
  },
  {
    target: panel('CardsPanel'),
    title: 'Cards',
    text: 'Character sheets, notes and other cards you can see. Click one to open it. Your own character sheet lives here.',
  },
  {
    target: panel('TurnOrderPanel'),
    title: 'Turn order',
    text: 'Who acts when, during combat. You’ll see whose turn it is, and when yours is coming up.',
  },
  {
    target: panel('PlayersPanel'),
    title: 'Players',
    text: 'Everyone in the game, and who is online right now.',
  },
  {
    target: tour('menu-views'),
    title: 'View menu',
    text: 'Open any panel from here: chat, dice, cards, turn order, tools, players and more. Closed something by accident? This is where you get it back.',
  },
  {
    target: tour('dock'),
    title: 'Arranging windows',
    text: 'Every panel is a window you can rearrange. Drag a tab to move it, drop it on an edge to dock it, or drag it out to float it. Minimized windows wait in the bar at the bottom.',
  },
  {
    target: tour('menu-layouts'),
    title: 'Layouts',
    text: 'Switch to a window layout the GM prepared, or save your own arrangement if the game allows it.',
  },
  {
    target: tour('menu-settings'),
    title: 'Settings',
    text: 'Settings → Player: your name, avatar and colour, and on the “This browser” tab, your sound volume. Keyboard Shortcuts lists the keys.',
  },
  {
    target: tour('menu-game'),
    title: 'Game menu',
    text: 'Run a command, leave the game, or replay this tutorial.',
  },
  {
    title: 'That’s it',
    text: `Have fun! There’s more in the Player guide: ${PLAYER_GUIDE_URL}`,
  },
];

/** Shown means: in the page and laid out (a panel in a background tab isn't). */
export const isShown = (el) => !!el && el.getClientRects().length > 0;

/**
 * The steps that can be shown right now: steps without a target always, others
 * only when their element is on screen. Each kept step carries its `element`.
 */
export function visibleSteps(steps, doc = document, isVisible = isShown) {
  const result = [];
  for (const step of steps) {
    if (!step.target) {
      result.push(step);
      continue;
    }
    const element = doc.querySelector(step.target);
    if (element && isVisible(element)) result.push({ ...step, element });
  }
  return result;
}

export function hasSeenTour(storage) {
  try {
    return storage?.getItem(TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTourSeen(storage) {
  try {
    storage?.setItem(TOUR_STORAGE_KEY, '1');
  } catch {
    // Storage blocked (private window, site data off): the tour just shows again next time.
  }
}

export const shouldStartTour = ({ isGM, storage }) => !isGM && !hasSeenTour(storage);

/**
 * Runs the tour with the steps that are on screen. Finishing or closing it counts
 * as seen. Returns the driver, or null when there was nothing to show.
 */
export function startPlayerTour({ steps = PLAYER_TOUR_STEPS, doc = document, storage, driverFactory, isVisible = isShown }) {
  const shown = visibleSteps(steps, doc, isVisible);
  if (!shown.some((s) => s.element)) return null;

  const tourDriver = driverFactory({
    showProgress: true,
    popoverClass: 'nm_tour',
    steps: shown.map((s) => ({
      ...(s.element ? { element: s.element } : {}),
      popover: { title: s.title, description: s.text },
    })),
    onDestroyed: () => markTourSeen(storage),
  });
  tourDriver.drive();
  return tourDriver;
}
