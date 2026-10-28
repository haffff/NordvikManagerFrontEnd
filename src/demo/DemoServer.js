// Stands in for the GM backend in the demo: answers REST requests from a recorded
// fixture (see fixtures.js) and answers commands the way GameLobby does, in memory.
// Nothing is saved: a reload starts over.

import { requestKey, commandKey } from './fixtures';

const NOT_IN_DEMO = 'Not available in the demo';
const ACTIONS_NOTE = 'Actions run on the GM’s server, so most of them can’t run in the demo.';

// Commands that ask for state: the recorded answer is replayed.
const QUERY_COMMANDS = new Set(['client_loaded', 'client_layout_ready', 'player_list', 'debug_mode_get']);
// Commands that change state: the server broadcasts them back (to everyone, sender included).
const MUTATION = /_(add|update|remove|delete|move|change|forcechange|rename|group|ungroup)$|^settings_/;
const LIST_COMMANDS = new Set(['property_list_item_add', 'property_list_item_remove', 'property_list_item_update', 'property_list_reorder']);

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/** The parentIds and names a QueryProperties call asks for (names: null = all). */
function propertyFilter(query) {
  const lower = Object.fromEntries(Object.entries(query ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const parents = new Set((lower.parentids ?? '').split(',').filter(Boolean));
  const names = lower.names ? new Set(lower.names.split(',').map(decodeURIComponent)) : null;
  return { parents, names };
}

// NdM, NdMkhK / NdMklK, and +/- numbers, e.g. "1d20+5", "2d20kh1+3", "3d6-1".
const TERM = /([+-]?)(?:(\d*)d(\d+)(?:(kh|kl)(\d+))?|(\d+))/gi;

/** Rolls a simple formula the way the server reports it, or null if it isn't one. */
export function rollFormula(formula, random = Math.random) {
  const text = String(formula ?? '').replace(/\s+/g, '');
  if (!text || !new RegExp(`^(${TERM.source})+$`, 'i').test(text)) return null;

  let result = 0;
  const dices = [];
  for (const [, sign, count, sides, keep, keepCount, flat] of text.matchAll(TERM)) {
    const mult = sign === '-' ? -1 : 1;
    if (flat) {
      result += mult * Number(flat);
      continue;
    }
    const rolled = Array.from({ length: Number(count || 1) }, () => 1 + Math.floor(random() * Number(sides)));
    const kept = new Set(rolled.map((_, i) => i));
    if (keep) {
      const order = rolled.map((v, i) => [v, i]).sort((a, b) => (keep === 'kh' ? b[0] - a[0] : a[0] - b[0]));
      kept.clear();
      order.slice(0, Number(keepCount)).forEach(([, i]) => kept.add(i));
    }
    rolled.forEach((value, i) => {
      dices.push({ index: dices.length, diceValue: Number(sides), times: 1, result: value, kept: kept.has(i) });
      if (kept.has(i)) result += mult * value;
    });
  }
  return { result, rolled: text, dices };
}

export class DemoServer {
  constructor(fixture, { random = Math.random, onNote = () => {} } = {}) {
    this.fixture = fixture ?? { requests: {}, after: {} };
    this.random = random;
    this.onNote = onNote;
    this.properties = new Map(); // id → property as changed or added during the visit
    this.removed = new Set();    // property ids removed during the visit
    this.rolls = new Map();      // rollId → results
    this.noted = new Set();
    this.nextId = 1;
    this.playerId = this.fixture.requests?.['GET api/battlemap/getplayer']?.body?.id;
  }

  newId() {
    return `demo-${this.nextId++}-${Math.floor(this.random() * 1e9).toString(36)}`;
  }

  /** quiet: something the app fetched by itself (not worth a toast), not something the visitor did. */
  note(key, text, { quiet = false } = {}) {
    if (this.noted.has(key)) return;
    this.noted.add(key);
    this.onNote(text, { quiet });
  }

  after(key) {
    return clone(this.fixture.after?.[key] ?? []);
  }

  // ── REST ────────────────────────────────────────────────────────────────────

  request({ method, path, query, body }) {
    const key = requestKey(method, path, query);

    if (key.startsWith('POST api/rolls/start')) {
      const results = [];
      for (const { key: rollKey, formula } of body?.formulas ?? []) {
        const roll = rollFormula(formula, this.random);
        if (!roll) return { status: 400, body: { error: `Invalid roll formula for '${rollKey}': ${formula}` }, broadcasts: [] };
        results.push({ key: rollKey, roll });
      }
      const rollId = this.newId();
      this.rolls.set(rollId, results);
      return { status: 200, body: { rollId, results }, broadcasts: [] };
    }
    if (key.startsWith('POST api/rolls/finish')) {
      if (!this.rolls.has(body?.rollId)) return { status: 404, body: { error: 'Unknown or expired roll.' }, broadcasts: [] };
      this.rolls.delete(body.rollId);
      return { status: 200, body: null, broadcasts: this.after(key) };
    }

    const recorded = this.fixture.requests?.[key];
    if (!recorded && key.startsWith('GET api/materials/resource?') && Array.isArray(this.fixture.resources)) {
      const lower = Object.fromEntries(Object.entries(query ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
      const res = this.fixture.resources.find((r) => (lower.id && r.id === lower.id) || (lower.key && r.key === lower.key));
      if (res) return { status: 200, body: { data: res.data, mimeType: res.mimeType, version: 'demo' }, broadcasts: [] };
    }
    const isPropertyQuery = key.startsWith('GET api/properties/queryproperties');
    if (!recorded && isPropertyQuery && Array.isArray(this.fixture.properties)) {
      const { parents, names } = propertyFilter(query);
      const matching = this.fixture.properties.filter((p) =>
        (!parents.size || parents.has(p.parentId)) && (!names || names.has(p.name)));
      return { status: 200, body: this.withPropertyChanges(clone(matching), query), broadcasts: [] };
    }
    if (!recorded) {
      this.note(key, `${NOT_IN_DEMO}: ${String(path).replace(/^api\//, '')}`, { quiet: String(method).toUpperCase() === 'GET' });
      return { status: 404, body: { error: NOT_IN_DEMO }, broadcasts: [] };
    }
    let answer = clone(recorded.body);
    if (isPropertyQuery) answer = this.withPropertyChanges(answer, query);
    return { status: recorded.status, body: answer, broadcasts: this.after(key) };
  }

  /** A recorded property list, with this visit's changes, additions and removals applied. */
  withPropertyChanges(list, query = {}) {
    if (!Array.isArray(list)) return list;
    const { parents, names } = propertyFilter(query);

    const result = list
      .filter((p) => !this.removed.has(p.id))
      .map((p) => (this.properties.has(p.id) ? { ...p, ...this.properties.get(p.id) } : p));
    const present = new Set(result.map((p) => p.id));
    for (const p of this.properties.values()) {
      if (present.has(p.id) || this.removed.has(p.id)) continue;
      if (parents.size && !parents.has(p.parentId)) continue;
      if (names && !names.has(p.name)) continue;
      result.push(p);
    }
    return result;
  }

  /** The current state of a property: changed in this visit, or as recorded. */
  findProperty(id) {
    if (this.removed.has(id)) return null;
    if (this.properties.has(id)) return this.properties.get(id);
    const listed = (this.fixture.properties ?? []).find((p) => p?.id === id);
    if (listed) return clone(listed);
    for (const { body } of Object.values(this.fixture.requests ?? {})) {
      if (!Array.isArray(body)) continue;
      const found = body.find((p) => p && p.id === id && 'value' in p);
      if (found) return clone(found);
    }
    return null;
  }

  // ── Commands ────────────────────────────────────────────────────────────────

  command(cmd) {
    const name = cmd?.command;
    if (!name) return [];

    if (name === 'chat_push') return this.chat(cmd);

    if (name === 'execute_action') {
      const replies = this.after(commandKey(cmd));
      if (!replies.length) this.note('execute_action', ACTIONS_NOTE);
      return replies;
    }

    if (QUERY_COMMANDS.has(name)) return this.after(name);

    if (LIST_COMMANDS.has(name)) return this.listChange(cmd);

    if (name === 'property_update' || name === 'property_add') {
      const data = { ...cmd.data, id: cmd.data?.id ?? this.newId() };
      this.properties.set(data.id, { ...(this.findProperty(data.id) ?? {}), ...data });
      return [{ ...cmd, data, result: 'Ok' }];
    }
    if (name === 'property_remove') {
      const id = typeof cmd.data === 'object' ? cmd.data?.id : cmd.data;
      this.removed.add(id);
      this.properties.delete(id);
      return [{ ...cmd, result: 'Ok' }];
    }

    if (MUTATION.test(name)) {
      const data = name.endsWith('_add') && cmd.data && typeof cmd.data === 'object' && !cmd.data.id
        ? { ...cmd.data, id: this.newId() }
        : cmd.data;
      return [{ ...cmd, data, result: 'Ok' }];
    }

    const replies = this.after(commandKey(cmd));
    if (!replies.length) this.note(name, `${NOT_IN_DEMO}: ${name}`);
    return replies;
  }

  chat(cmd) {
    const text = typeof cmd.data === 'string' ? cmd.data : '';
    const base = { ...cmd, playerId: this.playerId, result: 'Ok' };
    const [word, ...rest] = text.split(' ');

    if (/^\/(r|roll)$/i.test(word)) {
      const roll = rollFormula(rest.join(''), this.random);
      if (!roll) return [{ ...base, data: 'Invalid Roll' }];
      const template = { type: 'Roll', title: 'Roll', message: 'Roll', color: null, borderColor: null, roll };
      return [{ ...base, data: JSON.stringify(template), isTemplate: true }];
    }
    if (text.startsWith('/')) {
      const replies = this.after(commandKey(cmd));
      if (!replies.length) this.note(`chat ${word}`, `${NOT_IN_DEMO}: ${word}`);
      return replies;
    }
    return [base];
  }

  listChange(cmd) {
    const { propertyId, itemId, fields, orderedItemIds } = cmd.data ?? {};
    const property = this.findProperty(propertyId);
    if (!property) return [];
    let rows;
    try {
      rows = JSON.parse(property.value || '[]');
    } catch {
      rows = [];
    }
    switch (cmd.command) {
      case 'property_list_item_add':
        rows = [...rows, { id: itemId ?? this.newId(), fields }];
        break;
      case 'property_list_item_remove':
        rows = rows.filter((r) => r.id !== itemId);
        break;
      case 'property_list_item_update':
        rows = rows.map((r) => (r.id === itemId ? { ...r, fields } : r));
        break;
      case 'property_list_reorder':
        rows = (orderedItemIds ?? []).map((id) => rows.find((r) => r.id === id)).filter(Boolean);
        break;
      default:
        break;
    }
    const updated = { ...property, value: JSON.stringify(rows) };
    this.properties.set(propertyId, updated);
    return [{ command: 'property_update', data: updated, result: 'Ok' }];
  }
}
