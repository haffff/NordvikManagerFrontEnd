import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The dock's colours come from --nordvik-dock-* variables a game stylesheet can set
// (dock.css). The current tab has its own background and title colour, so a theme can
// colour the tab bar apart from the panel body behind the pages.
const css = fs.readFileSync(path.join(__dirname, 'dock.css'), 'utf8');

describe('dock.css', () => {
  it('lets a theme colour the current tab apart from the panel body', () => {
    expect(css).toContain('--dockable-panelTabActiveBkg: var(--nordvik-dock-tab-active, var(--nordvik-dock-panel, #1e1e1e));');
    expect(css).toContain('--dockable-panelTabActiveTextColor: var(--nordvik-dock-tab-active-text, var(--nordvik-dock-tab-text, #e8e8e8));');
    expect(css).toContain('--dockable-panelTabInactiveButtonColor: var(--nordvik-dock-tab-button, rgba(255,255,255,0.2));');
  });
});
