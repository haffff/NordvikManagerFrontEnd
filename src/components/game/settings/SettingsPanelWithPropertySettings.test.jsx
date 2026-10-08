import { vi, describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

vi.mock('./SettingsPanel', () => ({
  default: ({ dto }) => <pre data-testid="dto">{JSON.stringify(dto)}</pre>,
}));
vi.mock('../../../ClientMediator', () => ({ default: { sendCommandAsync: vi.fn() } }));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: {
    get: vi.fn((url, ok) => ok([{ name: 'mask_hp_enabled', value: 'False' }])),
    getAsync: vi.fn(),
  },
  ActiveTransportManager: { Send: vi.fn() },
}));

import { SettingsPanelWithPropertySettings } from './SettingsPanelWithPropertySettings';
import { maskSettingFields } from '../../../helpers/maskSettings';

describe('SettingsPanelWithPropertySettings', () => {
  it("reads each property through its field's parse, including unset ones", () => {
    renderWithProviders(
      <SettingsPanelWithPropertySettings
        dto={{ id: 'map-1' }}
        entityName="MapModel"
        editableKeyLabelDict={maskSettingFields([{ maskGroup: 'hp', label: 'HP bar' }])}
      />
    );

    const dto = JSON.parse(screen.getByTestId('dto').textContent);
    expect(dto).toMatchObject({ mask_hp_enabled: 'false', mask_hp_gmonly: 'notset' });
  });
});
