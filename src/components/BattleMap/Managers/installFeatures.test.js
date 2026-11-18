import { describe, it, expect } from 'vitest';
import { installFeatures } from './installFeatures';

const feature = (methods, meta = {}) => ({ methods, meta });

describe('installFeatures', () => {
  it('adds methods that run on the instance, and merges their descriptions', () => {
    class Service { value = 7; }
    installFeatures(Service, { Own: { description: 'own' } }, [
      feature({ Read() { return this.value; } }, { Read: { description: 'read' } }),
    ]);

    expect(new Service().Read()).toBe(7);
    expect(Object.keys(new Service().$meta)).toEqual(['Own', 'Read']);
  });

  it('refuses a method defined twice', () => {
    class Service { Read() {} }

    expect(() => installFeatures(Service, {}, [feature({ Read() {} })])).toThrow('Read is defined twice');
  });

  it('refuses a description given twice', () => {
    class Service {}

    expect(() => installFeatures(Service, { Read: {} }, [feature({}, { Read: {} })])).toThrow('Read is described twice');
  });
});
