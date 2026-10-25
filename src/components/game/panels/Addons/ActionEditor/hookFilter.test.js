import { describe, it, expect } from 'vitest';
import { filterField, filterHint, hookChange } from './hookFilter';

const CHAT = { value: 19, name: 'Chat Command', filter: 'Commands this action handles, e.g. poll, vote. Required.', filterRequired: true };
const PROP = { value: 11, name: 'Property Updated', filter: '', filterRequired: false };

// The server's hook list says which hooks take a filter and what it means (HookFilters).
describe('filterField', () => {
  it('shows the field, with the server\'s help, for a hook that takes a filter', () => {
    expect(filterField(CHAT)).toEqual({ help: CHAT.filter, required: true });
  });

  it('has no field for hooks without a filter, or no hook', () => {
    expect(filterField(PROP)).toBeNull();
    expect(filterField(undefined)).toBeNull();
  });
});

describe('hookChange', () => {
  it('keeps the filter when the new hook takes one, and drops it otherwise', () => {
    expect(hookChange(19, [CHAT, PROP], 'poll')).toEqual({ hook: 19, hookFilter: 'poll' });
    expect(hookChange(11, [CHAT, PROP], 'poll')).toEqual({ hook: 11, hookFilter: null });
    expect(hookChange(0, [CHAT, PROP], 'poll')).toEqual({ hook: 0, hookFilter: null });
  });
});

describe('filterHint', () => {
  it('lists a Chat Command action\'s commands', () => {
    expect(filterHint({ hook: 19, hookFilter: 'poll, vote' })).toBe('/poll /vote');
  });

  it('is empty without a filter', () => {
    expect(filterHint({ hook: 19 })).toBe('');
    expect(filterHint({ hook: 11, hookFilter: '' })).toBe('');
  });
});
