// Builds a dice expression for the backend's "/r" chat command from the dice roller UI
// state (components/game/dice/DiceRoller.js).
//
// The backend grammar (DiceExpressionParser.cs) attaches "!", keep/drop and cs/cf to a
// single NdX term, so keep/drop and count successes are only offered for a pool of one
// die type. The formula must not contain whitespace: ChatHandler splits "/r" messages on
// spaces and only reads the first word after it.

// Die order in the formula and in the UI. "F" is a Fudge/Fate die (-1/0/+1).
export const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100, 'F'];

export const emptyDiceState = () => ({
  pool: Object.fromEntries(DIE_TYPES.map((die) => [die, 0])),
  modifier: 0,
  advantage: 'none', // 'none' | 'adv' | 'dis'
  keepDrop: null, // null | { kind: 'kh'|'kl'|'dh'|'dl', count }
  exploding: false,
  successes: null, // null | { mode: 'cs'|'cf', cmp: '>'|'<'|'=', target }
});

const usedDice = (state) =>
  DIE_TYPES.filter((die) => (state.pool?.[die] ?? 0) > 0).map((die) => ({ die, count: state.pool[die] }));

const dieName = (die) => (die === 'F' ? 'dF' : `d${die}`);

const enabled = { enabled: true, reason: null };
const disabled = (reason) => ({ enabled: false, reason });

export function describeAvailability(state) {
  const dice = usedDice(state);
  const singleType = dice.length === 1;
  const onlyOneD20 = (state.pool?.[20] ?? 0) === 1;

  const advantage = onlyOneD20 ? enabled : disabled('Advantage needs exactly one d20 in the pool.');

  let keepDrop;
  if (!singleType) keepDrop = disabled('Keep/drop works with one type of die at a time.');
  else if (dice[0].count < 2) keepDrop = disabled('Keep/drop needs at least 2 dice.');
  else if (onlyOneD20 && state.advantage !== 'none') keepDrop = disabled('Advantage already keeps the best d20.');
  else keepDrop = enabled;

  const successes = singleType ? enabled : disabled('Counting successes works with one type of die at a time.');

  return { advantage, keepDrop, successes };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function buildDiceFormula(state) {
  const dice = usedDice(state);
  if (dice.length === 0) return null;

  const availability = describeAvailability(state);
  const useAdvantage = availability.advantage.enabled && state.advantage !== 'none';
  const useKeepDrop = availability.keepDrop.enabled && state.keepDrop;
  const useSuccesses = availability.successes.enabled && state.successes;

  const terms = dice.map(({ die, count }) => {
    if (die === 20 && useAdvantage) {
      return `2d20${state.exploding ? '!' : ''}${state.advantage === 'adv' ? 'kh1' : 'kl1'}`;
    }
    let term = `${count}${dieName(die)}`;
    if (state.exploding && die !== 'F') term += '!';
    if (useKeepDrop) term += `${state.keepDrop.kind}${clamp(state.keepDrop.count, 1, count - 1)}`;
    if (useSuccesses) term += `${state.successes.mode}${state.successes.cmp}${state.successes.target}`;
    return term;
  });

  let formula = terms.join('+');
  const modifier = Math.trunc(Number(state.modifier) || 0);
  if (modifier > 0) formula += `+${modifier}`;
  if (modifier < 0) formula += `${modifier}`;
  return formula;
}

const KEEP_DROP_TEXT = {
  kh: 'keep the highest',
  kl: 'keep the lowest',
  dh: 'drop the highest',
  dl: 'drop the lowest',
};
const CMP_TEXT = { '>': 'above', '<': 'below', '=': 'equal to' };

// Plain-language summary shown under the formula, so new players see what the
// formula means (and learn the /r syntax along the way).
export function describeFormula(state) {
  const dice = usedDice(state);
  if (dice.length === 0) return 'Pick some dice';

  const availability = describeAvailability(state);
  const parts = [`Roll ${dice.map(({ die, count }) => `${count}${dieName(die)}`).join(' + ')}`];

  if (availability.advantage.enabled && state.advantage === 'adv') parts[0] += ' with advantage';
  if (availability.advantage.enabled && state.advantage === 'dis') parts[0] += ' with disadvantage';
  if (availability.keepDrop.enabled && state.keepDrop) {
    const count = clamp(state.keepDrop.count, 1, dice[0].count - 1);
    parts.push(`${KEEP_DROP_TEXT[state.keepDrop.kind]} ${count}`);
  }
  if (state.exploding) parts.push('exploding');
  if (availability.successes.enabled && state.successes) {
    const what = state.successes.mode === 'cs' ? 'successes' : 'failures';
    parts.push(`count ${what} ${CMP_TEXT[state.successes.cmp]} ${state.successes.target}`);
  }

  const modifier = Math.trunc(Number(state.modifier) || 0);
  if (modifier > 0) parts.push(`add ${modifier}`);
  if (modifier < 0) parts.push(`subtract ${-modifier}`);

  return parts.join(', ');
}

export const toChatCommand = (formula) => `/r ${formula}`;
