import { vi, describe, it, expect } from 'vitest';

vi.mock('../../helpers/transport', () => ({
  ActiveWebHelper: { getResourceString: vi.fn(() => 'resource-url') },
}));

import DTOConverter from './DTOConverter';

// Regression coverage for Bring-Forward/Send-Backward (insideLayerIndex) being
// silently dropped from every outgoing update. It rides as its own top-level DTO
// field (like `layer`), not inside the JSON.stringify(object) blob — neither is
// in fabric's toObject() whitelist.
describe('DTOConverter — insideLayerIndex round-trip', () => {
  it('ConvertToDTO carries insideLayerIndex through to the top-level dto field', () => {
    const object = { id: 'obj-1', layer: 100, insideLayerIndex: 42, mapId: 'map-1' };
    const dto = DTOConverter.ConvertToDTO(object);
    expect(dto.insideLayerIndex).toBe(42);
  });

  it('ConvertToDTOMinified (used for drag/scale/rotate) also carries insideLayerIndex through', () => {
    const object = { id: 'obj-1', layer: 100, insideLayerIndex: 42, left: 10, top: 20 };
    const dto = DTOConverter.ConvertToDTOMinified(object, ['left', 'top']);
    expect(dto.insideLayerIndex).toBe(42);
  });

  it('ConvertFromDTO applies the dto-level insideLayerIndex back onto the object', () => {
    const dto = {
      object: JSON.stringify({ id: 'obj-1' }),
      id: 'obj-1',
      layer: 100,
      insideLayerIndex: 42,
    };
    const object = DTOConverter.ConvertFromDTO(dto);
    expect(object.insideLayerIndex).toBe(42);
  });

  it('round-trips insideLayerIndex through ConvertToDTO → ConvertFromDTO unchanged', () => {
    const original = { id: 'obj-1', layer: 100, insideLayerIndex: 42, mapId: 'map-1' };
    const dto = DTOConverter.ConvertToDTO(original);
    const restored = DTOConverter.ConvertFromDTO(dto);
    expect(restored.insideLayerIndex).toBe(42);
  });

  it('round-trips insideLayerIndex through the minified drag path unchanged', () => {
    const original = { id: 'obj-1', layer: 100, insideLayerIndex: 42, left: 10, top: 20 };
    const dto = DTOConverter.ConvertToDTOMinified(original, ['left', 'top']);
    const restored = DTOConverter.ConvertFromDTO(dto);
    expect(restored.insideLayerIndex).toBe(42);
  });

  it('leaves insideLayerIndex undefined (not dropped/crashed) for an object that never had one', () => {
    const object = { id: 'obj-1', layer: 100 };
    const dto = DTOConverter.ConvertToDTO(object);
    expect(dto.insideLayerIndex).toBeUndefined();
    const restored = DTOConverter.ConvertFromDTO(dto);
    expect(restored.insideLayerIndex).toBeUndefined();
  });
});
