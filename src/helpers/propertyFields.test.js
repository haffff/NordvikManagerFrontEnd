import { describe, it, expect } from 'vitest';
import { propertyNamesOf, readPropertyFields, splitPropertyValues } from './propertyFields';

// One field kept in two properties ("a" and "b"), next to plain property and dto fields.
const pair = {
  key: 'pair',
  property: true,
  propertyNames: ['a', 'b'],
  fromProperties: (get) => `${get('a') ?? '-'}/${get('b') ?? '-'}`,
  toProperties: (value) => {
    const [a, b] = value.split('/');
    return { a, b };
  },
};
const editables = [
  { key: 'name', type: 'string' },
  { key: 'size', property: true, type: 'number' },
  { key: 'shown', property: true, type: 'boolean' },
  { key: 'mode', property: true, parse: (raw) => raw ?? 'default' },
  pair,
];

describe('fields stored as properties', () => {
  it('lists the properties behind every property field', () => {
    expect(propertyNamesOf(editables)).toEqual(['size', 'shown', 'mode', 'a', 'b']);
  });

  it('reads each field from the stored properties', () => {
    const rows = [
      { name: 'size', value: '12.5' },
      { name: 'shown', value: 'True' },
      { name: 'a', value: 'x' },
      { name: 'name', value: 'ignored: not a property field' },
    ];

    expect(readPropertyFields(editables, rows)).toEqual({
      size: 12.5,
      shown: true,
      mode: 'default',
      pair: 'x/-',
    });
  });

  it('splits changed values into properties to store and the rest', () => {
    const { properties, rest } = splitPropertyValues(editables, { name: 'Map', size: 3, pair: '1/2' });

    expect(properties).toEqual({ size: 3, a: '1', b: '2' });
    expect(rest).toEqual({ name: 'Map' });
  });
});
