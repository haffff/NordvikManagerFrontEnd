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
  // The two ways out: the full conversion, and the minified one used for drag/scale/rotate.
  const paths = [
    {
      path: 'ConvertToDTO',
      toDto: (object) => DTOConverter.ConvertToDTO(object),
      object: () => ({ id: 'obj-1', layer: 100, insideLayerIndex: 42, mapId: 'map-1' }),
    },
    {
      path: 'ConvertToDTOMinified (used for drag/scale/rotate)',
      toDto: (object) => DTOConverter.ConvertToDTOMinified(object, ['left', 'top']),
      object: () => ({ id: 'obj-1', layer: 100, insideLayerIndex: 42, left: 10, top: 20 }),
    },
  ];

  it.each(paths)('$path carries insideLayerIndex through to the top-level dto field', ({ toDto, object }) => {
    expect(toDto(object()).insideLayerIndex).toBe(42);
  });

  it.each(paths)('round-trips insideLayerIndex through $path → ConvertFromDTO unchanged', ({ toDto, object }) => {
    expect(DTOConverter.ConvertFromDTO(toDto(object())).insideLayerIndex).toBe(42);
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

  it('leaves insideLayerIndex undefined (not dropped/crashed) for an object that never had one', () => {
    const object = { id: 'obj-1', layer: 100 };
    const dto = DTOConverter.ConvertToDTO(object);
    expect(dto.insideLayerIndex).toBeUndefined();
    const restored = DTOConverter.ConvertFromDTO(dto);
    expect(restored.insideLayerIndex).toBeUndefined();
  });
});
