import { describe, it, expect } from 'vitest';
import { MASK_NOT_SET, maskSettingFields, maskSettingValue, resolveMaskSetting } from './maskSettings';

describe('token element (mask) settings', () => {
  it('offers Not set, on and off for each element, Not set first', () => {
    const fields = maskSettingFields([{ maskGroup: 'hp', label: 'HP bar' }], { category: 'Override' });

    expect(fields.map((f) => f.key)).toEqual(['mask_hp_enabled', 'mask_hp_gmonly']);
    for (const f of fields) {
      expect(f).toMatchObject({ type: 'select', property: true, category: 'Override' });
      expect(f.options.map((o) => o.value)).toEqual([MASK_NOT_SET, 'true', 'false']);
      expect(f.options[0].label).toBe('Not set');
    }
  });

  it('shows a stored value as its option, and anything else as Not set', () => {
    expect(maskSettingValue('true')).toBe('true');
    expect(maskSettingValue('False')).toBe('false');
    expect(maskSettingValue(true)).toBe('true');
    expect(maskSettingValue(undefined)).toBe(MASK_NOT_SET);
    expect(maskSettingValue('')).toBe(MASK_NOT_SET);
    expect(maskSettingValue(MASK_NOT_SET)).toBe(MASK_NOT_SET);
  });

  it("uses the token's setting, else the map's, else the default", () => {
    expect(resolveMaskSetting('false', 'true', true)).toBe(false);
    expect(resolveMaskSetting(MASK_NOT_SET, 'false', true)).toBe(false);
    expect(resolveMaskSetting(undefined, MASK_NOT_SET, true)).toBe(true);
    expect(resolveMaskSetting('', undefined, false)).toBe(false);
  });
});
