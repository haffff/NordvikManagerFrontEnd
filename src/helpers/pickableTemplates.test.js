import { describe, it, expect } from 'vitest';
import { pickableTemplates } from './pickableTemplates';

// Hidden templates (e.g. an addon's internal one, only cloned by its importer) stay in
// the template list but aren't offered to pick from.
describe('pickableTemplates', () => {
  it('leaves out hidden templates', () => {
    const list = [{ id: 'a', name: 'Sheet' }, { id: 'b', name: 'Internal', isHidden: true }, { id: 'c', name: 'Other', isHidden: false }];

    expect(pickableTemplates(list).map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('copes with no list', () => {
    expect(pickableTemplates(undefined)).toEqual([]);
  });
});
