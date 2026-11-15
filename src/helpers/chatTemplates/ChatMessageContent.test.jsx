import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '../../setupTests';
import { ChatMessageContent } from './ChatMessageContent';

vi.mock('../transport', () => ({
  ActiveWebHelper: { getMaterialAsync: vi.fn(() => Promise.resolve(null)) },
  ActiveTransportManager: { Send: vi.fn() },
}));

const fakeRoll = '{"type":"Roll","title":"Attack","roll":{"rolled":"{0}","result":20,"dices":[{"index":0,"diceValue":20,"times":1,"result":20}]}}';

describe('ChatMessageContent', () => {
  let consoleError;
  beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => consoleError.mockRestore());

  // shown: text that must be on screen; hidden: text that must not be.
  it.each([
    { name: 'shows typed JSON as plain text — a player cannot post a roll card', item: { data: fakeRoll }, shown: fakeRoll, hidden: 'Attack' },
    { name: 'shows object data from a player as its JSON text', item: { data: { type: 'Generic', title: 'hi' } }, shown: '{"type":"Generic","title":"hi"}' },
    { name: 'renders a template when the server marked the message as one', item: { data: fakeRoll, isTemplate: true }, shown: 'Attack' },
    { name: 'falls back to the text for a template it cannot parse', item: { data: 'not json', isTemplate: true }, shown: 'not json' },
  ])('$name', ({ item, shown, hidden }) => {
    renderWithProviders(<ChatMessageContent item={item} />);
    expect(screen.getByText(shown)).toBeInTheDocument();
    if (hidden) expect(screen.queryByText(hidden)).not.toBeInTheDocument();
  });

  it('contains a template that fails to render to its own line', () => {
    renderWithProviders(
      <div>
        <ChatMessageContent item={{ data: '{"type":"Roll","roll":{"rolled":5,"dices":"x"}}', isTemplate: true }} />
        <span>next message</span>
      </div>
    );
    expect(screen.getByText(/could not be displayed/i)).toBeInTheDocument();
    expect(screen.getByText('next message')).toBeInTheDocument();
  });
});
