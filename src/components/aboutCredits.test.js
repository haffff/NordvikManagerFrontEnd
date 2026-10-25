import { describe, it, expect } from 'vitest';
import { CREDITS } from './aboutCredits';

describe('CREDITS', () => {
  it('names each project, its authors, its license and a link', () => {
    expect(CREDITS.length).toBeGreaterThan(5);
    for (const c of CREDITS) {
      expect(c.name, JSON.stringify(c)).toBeTruthy();
      expect(c.by, c.name).toBeTruthy();
      expect(c.license, c.name).toMatch(/^(MIT|Apache-2\.0|BSD-[23]-Clause|MPL-2\.0 OR Apache-2\.0)$/);
      expect(c.url, c.name).toMatch(/^https:\/\//);
      expect(c.what, c.name).toBeTruthy();
    }
  });

  it('starts with react-dockable by hlorenzi, the base of the dock', () => {
    expect(CREDITS[0]).toMatchObject({ name: 'react-dockable', by: 'hlorenzi', license: 'Apache-2.0' });
  });
});
