import { describe, it, expect } from 'vitest';
import { MASK_NOT_SET, maskSettingFields, resolveMaskSetting } from './maskSettings';

const hpField = (options) => maskSettingFields([{ maskGroup: 'hp', label: 'HP bar' }], options)[0];

// Reads stored property values the way the settings panels hand them over.
const stored = (values) => (name) => values[name];

describe('token element (mask) settings', () => {
  it('offers one four-way choice per element: Not set, Visible, GM only, Hidden', () => {
    const fields = maskSettingFields([{ maskGroup: 'hp', label: 'HP bar' }], { category: 'Override' });

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      key: 'mask_hp_mode',
      label: 'HP bar',
      type: 'segmented',
      property: true,
      category: 'Override',
      propertyNames: ['mask_hp_enabled', 'mask_hp_gmonly'],
    });
    expect(fields[0].options.map((o) => o.label)).toEqual(['Not set', 'Visible', 'GM only', 'Hidden']);
    expect(fields[0].options[0].value).toBe(MASK_NOT_SET);
  });

  it('shows the stored pair of properties as one choice', () => {
    const read = hpField().fromProperties;

    expect(read(stored({}))).toBe(MASK_NOT_SET);
    expect(read(stored({ mask_hp_enabled: 'notset', mask_hp_gmonly: 'notset' }))).toBe(MASK_NOT_SET);
    expect(read(stored({ mask_hp_enabled: 'True', mask_hp_gmonly: 'False' }))).toBe('visible');
    expect(read(stored({ mask_hp_enabled: 'true', mask_hp_gmonly: 'true' }))).toBe('gmonly');
    expect(read(stored({ mask_hp_enabled: 'false', mask_hp_gmonly: 'true' }))).toBe('hidden');
    expect(read(stored({ mask_hp_enabled: 'false' }))).toBe('hidden');
    // Only one of the pair set (e.g. an addon's own "Show bars" switch):
    expect(read(stored({ mask_hp_enabled: 'true' }))).toBe('visible');
    expect(read(stored({ mask_hp_gmonly: 'true' }))).toBe('gmonly');
  });

  it('stores each choice as both properties, so it fully replaces what was set before', () => {
    const write = hpField().toProperties;

    expect(write(MASK_NOT_SET)).toEqual({ mask_hp_enabled: MASK_NOT_SET, mask_hp_gmonly: MASK_NOT_SET });
    expect(write('visible')).toEqual({ mask_hp_enabled: 'true', mask_hp_gmonly: 'false' });
    expect(write('gmonly')).toEqual({ mask_hp_enabled: 'true', mask_hp_gmonly: 'true' });
    expect(write('hidden')).toEqual({ mask_hp_enabled: 'false', mask_hp_gmonly: 'false' });
  });

  it('round-trips every choice', () => {
    const field = hpField();
    for (const { value } of field.options) {
      expect(field.fromProperties(stored(field.toProperties(value)))).toBe(value);
    }
  });

  it("uses the token's setting, else the map's, else the default", () => {
    expect(resolveMaskSetting('false', 'true', true)).toBe(false);
    expect(resolveMaskSetting(MASK_NOT_SET, 'false', true)).toBe(false);
    expect(resolveMaskSetting(undefined, MASK_NOT_SET, true)).toBe(true);
    expect(resolveMaskSetting('', undefined, false)).toBe(false);
  });
});
