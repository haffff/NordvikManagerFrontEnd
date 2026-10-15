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

  it('shows typed JSON as plain text — a player cannot post a roll card', () => {
    renderWithProviders(<ChatMessageContent item={{ data: fakeRoll }} />);
    expect(screen.getByText(fakeRoll)).toBeInTheDocument();
    expect(screen.queryByText('Attack')).not.toBeInTheDocument();
  });

  it('shows object data from a player as its JSON text', () => {
    renderWithProviders(<ChatMessageContent item={{ data: { type: 'Generic', title: 'hi' } }} />);
    expect(screen.getByText('{"type":"Generic","title":"hi"}')).toBeInTheDocument();
  });

  it('renders a template when the server marked the message as one', () => {
    renderWithProviders(<ChatMessageContent item={{ data: fakeRoll, isTemplate: true }} />);
    expect(screen.getByText('Attack')).toBeInTheDocument();
  });

  it('falls back to the text for a template it cannot parse', () => {
    renderWithProviders(<ChatMessageContent item={{ data: 'not json', isTemplate: true }} />);
    expect(screen.getByText('not json')).toBeInTheDocument();
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
