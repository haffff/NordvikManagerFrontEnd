import { vi, describe, it, expect, beforeEach } from 'vitest';
import { waitFor, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../setupTests';

vi.mock('../../../helpers/WebHelper', () => ({
  default: {
    getAsync: vi.fn(),
    postAsync: vi.fn(),
    putAsync: vi.fn(),
    deleteAsync: vi.fn(),
    downloadFileAsync: vi.fn(),
  },
}));
vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import WebHelper from '../../../helpers/WebHelper';
import { toaster } from '../../ui/toaster';
import { BackupSettingsTab } from './BackupSettingsTab';

const MANUAL = 'nordvik-backup-20261012-083000000-manual-before-session.zip';
const SCHEDULED = 'nordvik-backup-20261011-083000000-scheduled.zip';

const status = (overrides = {}) => ({
  supported: true,
  backups: [
    { name: MANUAL, kind: 'Manual', createdAtUtc: '2026-10-12T08:30:00Z', sizeBytes: 2 * 1024 * 1024, label: 'before-session' },
    { name: SCHEDULED, kind: 'Scheduled', createdAtUtc: '2026-10-11T08:30:00Z', sizeBytes: 1024 },
  ],
  pendingRestore: null,
  failedRestore: null,
  ...overrides,
});

const schedule = { enabled: false, intervalHours: 24, retentionCount: 7, lastRunUtc: null, nextRunUtc: null };

const mockGets = (statusValue = status()) => {
  WebHelper.getAsync.mockImplementation(async (addr) => (addr === 'backup/schedule' ? schedule : statusValue));
};

describe('BackupSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGets();
  });

  it('lists the backups on the server', async () => {
    renderWithProviders(<BackupSettingsTab />);

    expect(await screen.findByText(MANUAL)).toBeTruthy();
    expect(screen.getByText(SCHEDULED)).toBeTruthy();
    expect(screen.getByText('2.0 MB')).toBeTruthy();
  });

  it('creates a backup with the given label', async () => {
    WebHelper.postAsync.mockResolvedValue({ ok: true, json: async () => ({ name: MANUAL }) });
    renderWithProviders(<BackupSettingsTab />);
    await screen.findByText(MANUAL);

    fireEvent.change(screen.getByPlaceholderText(/label/i), { target: { value: 'before session' } });
    fireEvent.click(screen.getByRole('button', { name: /back up now/i }));

    await waitFor(() => expect(WebHelper.postAsync).toHaveBeenCalledWith('backup', { label: 'before session' }));
    await waitFor(() => expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' })));
  });

  it('shows the server error when a backup fails', async () => {
    WebHelper.postAsync.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Disk full' }) });
    renderWithProviders(<BackupSettingsTab />);
    await screen.findByText(MANUAL);

    fireEvent.click(screen.getByRole('button', { name: /back up now/i }));

    await waitFor(() =>
      expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', description: 'Disk full' }))
    );
  });

  it('asks for a second click before staging a restore', async () => {
    WebHelper.postAsync.mockResolvedValue({ ok: true, json: async () => ({ backupName: MANUAL }) });
    renderWithProviders(<BackupSettingsTab />);
    await screen.findByText(MANUAL);

    fireEvent.click(screen.getByRole('button', { name: `Restore ${MANUAL}` }));
    expect(WebHelper.postAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: `Confirm restore ${MANUAL}` }));
    await waitFor(() => expect(WebHelper.postAsync).toHaveBeenCalledWith(`backup/${MANUAL}/restore`, {}));
  });

  it('asks for a second click before deleting', async () => {
    WebHelper.deleteAsync.mockResolvedValue(true);
    renderWithProviders(<BackupSettingsTab />);
    await screen.findByText(MANUAL);

    fireEvent.click(screen.getByRole('button', { name: `Delete ${MANUAL}` }));
    expect(WebHelper.deleteAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: `Confirm delete ${MANUAL}` }));
    await waitFor(() => expect(WebHelper.deleteAsync).toHaveBeenCalledWith(`backup/${MANUAL}`));
  });

  it('downloads a backup', async () => {
    renderWithProviders(<BackupSettingsTab />);
    await screen.findByText(MANUAL);

    fireEvent.click(screen.getByRole('button', { name: `Download ${MANUAL}` }));

    expect(WebHelper.downloadFileAsync).toHaveBeenCalledWith(`backup/${MANUAL}/download`, MANUAL);
  });

  it('shows an error when a download fails', async () => {
    WebHelper.downloadFileAsync.mockResolvedValue(false);
    renderWithProviders(<BackupSettingsTab />);
    await screen.findByText(MANUAL);

    fireEvent.click(screen.getByRole('button', { name: `Download ${MANUAL}` }));

    await waitFor(() => expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
  });

  it('uploads a backup file as multipart form data to restore it', async () => {
    WebHelper.postAsync.mockResolvedValue({ ok: true, json: async () => ({ backupName: 'x.zip' }) });
    renderWithProviders(<BackupSettingsTab />);
    await screen.findByText(MANUAL);

    const file = new File(['zip'], 'backup.zip', { type: 'application/zip' });
    fireEvent.change(screen.getByTestId('backup-upload-input'), { target: { files: [file] } });

    await waitFor(() => expect(WebHelper.postAsync).toHaveBeenCalled());
    const [addr, body, formData] = WebHelper.postAsync.mock.calls[0];
    expect(addr).toBe('backup/restore/upload');
    expect(formData).toBe(true);
    expect(body.get('file')).toBe(file);
  });

  it('shows a pending restore and can cancel it', async () => {
    mockGets(status({ pendingRestore: { backupName: MANUAL, stagedAtUtc: '2026-10-12T09:00:00Z' } }));
    WebHelper.deleteAsync.mockResolvedValue(true);
    renderWithProviders(<BackupSettingsTab />);

    expect(await screen.findByText(/will be restored when the server restarts/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /cancel restore/i }));

    await waitFor(() => expect(WebHelper.deleteAsync).toHaveBeenCalledWith('backup/restore/pending'));
  });

  it('shows a failed restore', async () => {
    mockGets(status({ failedRestore: { backupName: MANUAL, stagedAtUtc: '2026-10-12T09:00:00Z' } }));
    renderWithProviders(<BackupSettingsTab />);

    expect(await screen.findByText(/could not be restored/i)).toBeTruthy();
  });

  it('saves the schedule', async () => {
    WebHelper.putAsync.mockResolvedValue({ ok: true, json: async () => ({ ...schedule, enabled: true }) });
    renderWithProviders(<BackupSettingsTab />);
    await screen.findByText(MANUAL);

    await userEvent.click(screen.getByRole('checkbox', { name: /scheduled backups/i }));
    fireEvent.click(screen.getByRole('button', { name: /save schedule/i }));

    await waitFor(() =>
      expect(WebHelper.putAsync).toHaveBeenCalledWith('backup/schedule', { enabled: true, intervalHours: 24, retentionCount: 7 })
    );
  });

  it('explains when the database cannot be backed up', async () => {
    mockGets(status({ supported: false, backups: [] }));
    renderWithProviders(<BackupSettingsTab />);

    expect(await screen.findByText(/only available with the SQLite database/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /back up now/i })).toBeNull();
  });
});
