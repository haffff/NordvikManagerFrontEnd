import { vi, describe, it, expect, beforeEach } from 'vitest';
import { waitFor, screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

vi.mock('../../../helpers/WebHelper', () => ({
  default: {
    getAsync: vi.fn(),
    putAsync: vi.fn(),
  },
}));
vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import WebHelper from '../../../helpers/WebHelper';
import { toaster } from '../../ui/toaster';
import { ServerSettingsTab } from './ServerSettingsTab';

const settings = (overrides = {}) => ({
  canEdit: true,
  error: null,
  proxyAllowedPrivateHosts: { locked: ['trilium.lan'], entries: ['localhost:8080'] },
  sandboxAllowedOrigins: { locked: ['https://fonts.gstatic.com'], entries: [] },
  addonRegistry: {
    mainRepository: { fromConfig: 'https://repo.example/addons.json', saved: null },
    featuredAddons: { fromConfig: ['dnd5e'], saved: null },
  },
  ...overrides,
});

const ok = (body) => ({ ok: true, json: async () => body });

const section = (name) => screen.getByRole('region', { name });

describe('ServerSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    WebHelper.getAsync.mockResolvedValue(settings());
  });

  it('shows the appsettings entries as locked and the saved ones as removable', async () => {
    renderWithProviders(<ServerSettingsTab />);

    expect(await screen.findByText('trilium.lan')).toBeTruthy();
    expect(screen.getByText('localhost:8080')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove localhost:8080' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove trilium.lan' })).toBeNull();
    expect(WebHelper.getAsync).toHaveBeenCalledWith('serversettings');
  });

  it('adds a private host and saves the whole list', async () => {
    WebHelper.putAsync.mockResolvedValue(ok(settings({ proxyAllowedPrivateHosts: { locked: ['trilium.lan'], entries: ['localhost:8080', '192.168.1.20:8080'] } })));
    renderWithProviders(<ServerSettingsTab />);
    await screen.findByText('localhost:8080');

    const hosts = section('Local network access');
    fireEvent.change(hosts.querySelector('input'), { target: { value: ' 192.168.1.20:8080 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add private host' }));

    await waitFor(() =>
      expect(WebHelper.putAsync).toHaveBeenCalledWith('serversettings/proxy-allowed-private-hosts', { hosts: ['localhost:8080', '192.168.1.20:8080'] })
    );
    expect(await screen.findByText('192.168.1.20:8080')).toBeTruthy();
  });

  it('removes a saved private host', async () => {
    WebHelper.putAsync.mockResolvedValue(ok(settings({ proxyAllowedPrivateHosts: { locked: ['trilium.lan'], entries: [] } })));
    renderWithProviders(<ServerSettingsTab />);
    await screen.findByText('localhost:8080');

    fireEvent.click(screen.getByRole('button', { name: 'Remove localhost:8080' }));

    await waitFor(() =>
      expect(WebHelper.putAsync).toHaveBeenCalledWith('serversettings/proxy-allowed-private-hosts', { hosts: [] })
    );
    await waitFor(() => expect(screen.queryByText('localhost:8080')).toBeNull());
  });

  it('adds a sandbox origin', async () => {
    WebHelper.putAsync.mockResolvedValue(ok(settings({ sandboxAllowedOrigins: { locked: ['https://fonts.gstatic.com'], entries: ['https://cdn.example.com'] } })));
    renderWithProviders(<ServerSettingsTab />);
    await screen.findByText('localhost:8080');

    fireEvent.change(section('Card sandbox').querySelector('input'), { target: { value: 'https://cdn.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add sandbox origin' }));

    await waitFor(() =>
      expect(WebHelper.putAsync).toHaveBeenCalledWith('serversettings/sandbox-allowed-origins', { origins: ['https://cdn.example.com'] })
    );
  });

  it('shows the server error and keeps the list when a save is refused', async () => {
    WebHelper.putAsync.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Not a host or host:port: http://x.' }) });
    renderWithProviders(<ServerSettingsTab />);
    await screen.findByText('localhost:8080');

    fireEvent.change(section('Local network access').querySelector('input'), { target: { value: 'http://x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add private host' }));

    await waitFor(() =>
      expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', description: 'Not a host or host:port: http://x.' }))
    );
    expect(screen.getByText('localhost:8080')).toBeTruthy();
    expect(section('Local network access').querySelector('input').value).toBe('http://x');
  });

  it('is read-only when the server owner locked the settings', async () => {
    WebHelper.getAsync.mockResolvedValue(settings({ canEdit: false }));
    renderWithProviders(<ServerSettingsTab />);
    await screen.findByText('localhost:8080');

    expect(screen.getByText(/AllowRuntimeSettings/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove localhost:8080' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add private host' }).disabled).toBe(true);
  });

  it('shows why the settings file could not be read', async () => {
    WebHelper.getAsync.mockResolvedValue(settings({ error: 'server-settings.json can\'t be read' }));
    renderWithProviders(<ServerSettingsTab />);

    expect(await screen.findByText(/server-settings.json can't be read/)).toBeTruthy();
  });

  it('shows an error when the settings cannot be loaded', async () => {
    WebHelper.getAsync.mockResolvedValue(undefined);
    renderWithProviders(<ServerSettingsTab />);

    expect(await screen.findByText(/Could not load the server settings/)).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Addon registry: a saved value replaces the appsettings one; null goes back.
  // -------------------------------------------------------------------------

  it('shows the appsettings registry when nothing is saved', async () => {
    renderWithProviders(<ServerSettingsTab />);
    await screen.findByText('localhost:8080');

    const registry = section('Addon registry');
    expect(registry.textContent).toContain('https://repo.example/addons.json');
    expect(registry.textContent).toContain('dnd5e');
    expect(screen.queryByRole('button', { name: 'Use the server config registry' })).toBeNull();
  });

  it('saves a registry URL, keeping the featured addons as they are', async () => {
    WebHelper.putAsync.mockResolvedValue(ok(settings()));
    renderWithProviders(<ServerSettingsTab />);
    await screen.findByText('localhost:8080');

    fireEvent.change(screen.getByLabelText('Registry URL'), { target: { value: 'https://mine.example/addons.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save registry' }));

    await waitFor(() =>
      expect(WebHelper.putAsync).toHaveBeenCalledWith('serversettings/addon-registry', { mainRepository: 'https://mine.example/addons.json', featuredAddons: null })
    );
  });

  it('goes back to the appsettings registry', async () => {
    WebHelper.getAsync.mockResolvedValue(settings({
      addonRegistry: {
        mainRepository: { fromConfig: 'https://repo.example/addons.json', saved: 'https://mine.example/addons.json' },
        featuredAddons: { fromConfig: ['dnd5e'], saved: ['themes'] },
      },
    }));
    WebHelper.putAsync.mockResolvedValue(ok(settings()));
    renderWithProviders(<ServerSettingsTab />);
    await screen.findByText('localhost:8080');

    fireEvent.click(screen.getByRole('button', { name: 'Use the server config registry' }));

    await waitFor(() =>
      expect(WebHelper.putAsync).toHaveBeenCalledWith('serversettings/addon-registry', { mainRepository: null, featuredAddons: ['themes'] })
    );
  });

  it('adding a featured addon starts from the appsettings list', async () => {
    WebHelper.putAsync.mockResolvedValue(ok(settings()));
    renderWithProviders(<ServerSettingsTab />);
    await screen.findByText('localhost:8080');

    fireEvent.change(screen.getByLabelText('Featured addon key'), { target: { value: 'themes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add featured addon' }));

    await waitFor(() =>
      expect(WebHelper.putAsync).toHaveBeenCalledWith('serversettings/addon-registry', { mainRepository: null, featuredAddons: ['dnd5e', 'themes'] })
    );
  });

  it('goes back to the appsettings featured list', async () => {
    WebHelper.getAsync.mockResolvedValue(settings({
      addonRegistry: {
        mainRepository: { fromConfig: 'https://repo.example/addons.json', saved: null },
        featuredAddons: { fromConfig: ['dnd5e'], saved: ['themes'] },
      },
    }));
    WebHelper.putAsync.mockResolvedValue(ok(settings()));
    renderWithProviders(<ServerSettingsTab />);
    await screen.findByText('localhost:8080');

    fireEvent.click(screen.getByRole('button', { name: 'Use the server config featured addons' }));

    await waitFor(() =>
      expect(WebHelper.putAsync).toHaveBeenCalledWith('serversettings/addon-registry', { mainRepository: null, featuredAddons: null })
    );
  });
});
