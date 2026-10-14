import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

import ChatSearch from './ChatSearch';

const players = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

const renderSearch = (props = {}) => {
  const handlers = { setFilter: vi.fn(), setFrom: vi.fn() };
  renderWithProviders(<ChatSearch players={players} {...handlers} {...props} />);
  return handlers;
};

const summary = () => screen.getByTestId('chat-search-summary').textContent;

describe('ChatSearch', () => {
  it('filters by text as you type', () => {
    const { setFilter } = renderSearch();

    fireEvent.change(screen.getByLabelText('Contains'), { target: { value: 'goblin' } });

    expect(setFilter).toHaveBeenCalledWith('goblin');
  });

  it('clears the text filter when the box is emptied', () => {
    const { setFilter } = renderSearch({ filter: 'goblin' });

    fireEvent.change(screen.getByLabelText('Contains'), { target: { value: '' } });

    expect(setFilter).toHaveBeenCalledWith(undefined);
  });

  it('filters by sender', () => {
    const { setFrom } = renderSearch();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: 'p2' } });

    expect(setFrom).toHaveBeenCalledWith('p2');
  });

  it('describes what is shown', () => {
    renderSearch();
    expect(summary()).toMatch(/all messages/i);
  });

  it('describes an active search', () => {
    renderSearch({ filter: 'goblin', from: 'p2' });
    expect(summary()).toMatch(/from Bob/);
    expect(summary()).toMatch(/"goblin"/);
  });

  it('clears both filters', () => {
    const { setFilter, setFrom } = renderSearch({ filter: 'goblin', from: 'p2' });

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(setFilter).toHaveBeenCalledWith(undefined);
    expect(setFrom).toHaveBeenCalledWith(undefined);
  });

  it('has nothing to clear without a search', () => {
    renderSearch();
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeDisabled();
  });

  it('keeps typing away from the game keyboard bindings', () => {
    const outer = vi.fn();
    renderWithProviders(
      <div onKeyDown={outer}>
        <ChatSearch players={players} setFilter={vi.fn()} setFrom={vi.fn()} />
      </div>
    );

    fireEvent.keyDown(screen.getByLabelText('Contains'), { key: 'a' });

    expect(outer).not.toHaveBeenCalled();
  });
});
