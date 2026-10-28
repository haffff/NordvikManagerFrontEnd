import { vi, describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

vi.mock('./SettingsPanel', () => ({
  default: ({ dto, onSave }) => (
    <>
      <pre data-testid="dto">{JSON.stringify(dto)}</pre>
      <button onClick={() => onSave({ mask_hp_mode: 'gmonly' })}>save</button>
    </>
  ),
}));
vi.mock('../../../ClientMediator', () => ({ default: { sendCommandAsync: vi.fn() } }));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: {
    get: vi.fn((url, ok) => ok([{ name: 'mask_hp_enabled', value: 'False' }])),
    getAsync: vi.fn(async () => [{ id: 'p1', name: 'mask_hp_enabled', value: 'False' }]),
  },
  ActiveTransportManager: { Send: vi.fn() },
}));

import ClientMediator from '../../../ClientMediator';
import { ActiveTransportManager } from '../../../helpers/transport';
import { SettingsPanelWithPropertySettings } from './SettingsPanelWithPropertySettings';
import { maskSettingFields } from '../../../helpers/maskSettings';

const renderHpPanel = () =>
  renderWithProviders(
    <SettingsPanelWithPropertySettings
      dto={{ id: 'map-1' }}
      entityName="MapModel"
      editableKeyLabelDict={maskSettingFields([{ maskGroup: 'hp', label: 'HP bar' }])}
    />
  );

describe('SettingsPanelWithPropertySettings', () => {
  it('reads a field kept in several properties as one value', () => {
    renderHpPanel();

    const dto = JSON.parse(screen.getByTestId('dto').textContent);
    expect(dto).toMatchObject({ mask_hp_mode: 'hidden' });
  });

  it('saves such a field into each of its properties, updating or adding them', async () => {
    renderHpPanel();

    fireEvent.click(screen.getByText('save'));

    await waitFor(() =>
      expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith('properties', 'UpdateBulk', {
        properties: [{ id: 'p1', name: 'mask_hp_enabled', value: 'true' }],
      })
    );
    expect(ActiveTransportManager.Send).toHaveBeenCalledWith({
      command: 'property_add',
      data: { name: 'mask_hp_gmonly', value: 'true', parentId: 'map-1', EntityName: 'MapModel' },
    });
    expect(ActiveTransportManager.Send).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'mask_hp_mode' }) })
    );
  });
});
