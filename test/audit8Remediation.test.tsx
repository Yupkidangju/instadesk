import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MetricsLogsView } from '../src/components/telemetry/MetricsLogsView';
import { ProcessListView } from '../src/components/telemetry/ProcessListView';
import { DesktopScreenView } from '../src/components/desktop/DesktopScreenView';
import { SidebarVmList } from '../src/components/SidebarVmList';
import { ApiKeyModal } from '../src/components/modals/ApiKeyModal';
import { instaboxClient } from '../src/services/instaboxClient';
import { cryptoVault } from '../src/services/cryptoVault';
import { useAppStore } from '../src/store/useAppStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  cryptoVault.resetVault();
  useAppStore.getState().clearAllTiles();
  useAppStore.setState({ machines: [], isDemoMode: false });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useAppStore.getState().closeApiKeyModal();
  useAppStore.getState().clearAllTiles();
  cryptoVault.resetVault();
});

describe('Audit 8 Minor Findings Remediation', () => {
  it('renders logs and shows error banner on partial telemetry failure, ignoring stale responses (DBG-F020)', async () => {
    const firstLogs = deferred<{ machineId: string; state: string; console: string; cursor: number; operations: [] }>();
    vi.spyOn(instaboxClient, 'getLogs')
      .mockReturnValueOnce(firstLogs.promise)
      .mockResolvedValueOnce({
        machineId: 'm_2',
        state: 'running',
        console: 'fresh-logs-m2',
        cursor: 2,
        operations: [],
      });
    vi.spyOn(instaboxClient, 'getMetrics')
      .mockRejectedValueOnce(new Error('metrics unavailable 1'))
      .mockRejectedValueOnce(new Error('metrics unavailable 2'));

    const view = render(<MetricsLogsView machineId="m_1" profileId="p1" />);
    view.rerender(<MetricsLogsView machineId="m_2" profileId="p1" />);

    await waitFor(() => expect(screen.getByText('fresh-logs-m2')).toBeDefined());
    expect(screen.getByRole('alert').textContent).toContain('Metrics: metrics unavailable 2');

    // 먼저 시작한 m_1 응답이 뒤늦게 도착해도 m_2 화면을 덮지 않아야 함
    await act(async () => {
      firstLogs.resolve({
        machineId: 'm_1',
        state: 'running',
        console: 'stale-logs-m1',
        cursor: 1,
        operations: [],
      });
      await Promise.resolve();
    });
    expect(screen.queryByText('stale-logs-m1')).toBeNull();
    expect(screen.getByText('fresh-logs-m2')).toBeDefined();
  });

  it('ignores stale ProcessListView responses after machine change (DBG-F020)', async () => {
    const first = deferred<{ machineId: string; state: string; live: boolean; capturedAt: string; processes: Array<{ pid: number; ppid: number; user: string; cpuPct: number; memPct: number; elapsedSec: number; args: string }> }>();
    vi.spyOn(instaboxClient, 'getProcesses')
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({
        machineId: 'm_2',
        state: 'running',
        live: true,
        capturedAt: new Date().toISOString(),
        processes: [{ pid: 202, ppid: 1, user: 'user', cpuPct: 1, memPct: 2, elapsedSec: 10, args: 'fresh-proc' }],
      });

    const view = render(<ProcessListView machineId="m_1" profileId="p1" />);
    view.rerender(<ProcessListView machineId="m_2" profileId="p1" />);

    await waitFor(() => expect(screen.getByText('fresh-proc')).toBeDefined());
    await act(async () => {
      first.resolve({
        machineId: 'm_1',
        state: 'running',
        live: true,
        capturedAt: new Date().toISOString(),
        processes: [{ pid: 101, ppid: 1, user: 'user', cpuPct: 1, memPct: 2, elapsedSec: 5, args: 'stale-proc' }],
      });
      await Promise.resolve();
    });

    expect(screen.queryByText('stale-proc')).toBeNull();
    expect(screen.getByText('fresh-proc')).toBeDefined();
  });

  it('ignores stale DesktopScreenView stream link responses when viewOnly toggles (DBG-F021)', async () => {
    vi.spyOn(instaboxClient, 'desktopAction').mockResolvedValue({
      installed: true,
      running: true,
      width: 1280,
      height: 800,
    });
    const staleLink = deferred<{ url: string; expiresAt: string }>();
    const createLink = vi.spyOn(instaboxClient, 'createDesktopStreamLink')
      .mockReturnValueOnce(staleLink.promise)
      .mockResolvedValueOnce({
        url: 'https://dashboard.instabox.sh/desktop/m_1#fresh',
        expiresAt: new Date().toISOString(),
      });

    const view = render(
      <DesktopScreenView machineId="m_1" profileId="demo-default" viewOnly={true} onViewOnlyChange={vi.fn()} />
    );
    await waitFor(() => expect(createLink).toHaveBeenCalledTimes(1));

    view.rerender(
      <DesktopScreenView machineId="m_1" profileId="demo-default" viewOnly={false} onViewOnlyChange={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText('GUI DESKTOP STREAM ACTIVE')).toBeDefined());

    await act(async () => {
      staleLink.resolve({
        url: 'https://dashboard.instabox.sh/desktop/m_1#stale',
        expiresAt: new Date().toISOString(),
      });
      await Promise.resolve();
    });

    const link = screen.getByTitle('Open full stream viewer in new tab') as HTMLAnchorElement;
    expect(link.href).toContain('#fresh');
  });

  it('blocks duplicate SidebarVmList machine actions while pending and displays failure alert (DBG-F023)', async () => {
    const demo = await instaboxClient.listMachines('demo-default');
    useAppStore.setState({ machines: [demo[0]], isDemoMode: true });

    const pendingControl = deferred<void>();
    const controlSpy = vi.spyOn(useAppStore.getState(), 'controlMachine').mockReturnValueOnce(pendingControl.promise);

    render(<SidebarVmList isOpen={true} onClose={vi.fn()} />);

    const suspendBtn = screen.getByTitle('Pause / Suspend') as HTMLButtonElement;
    fireEvent.click(suspendBtn);
    fireEvent.click(suspendBtn);

    expect(controlSpy).toHaveBeenCalledTimes(1);
    expect(suspendBtn.disabled).toBe(true);

    await act(async () => {
      pendingControl.reject(new Error('Conflict 409'));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Conflict 409'));
    expect(suspendBtn.disabled).toBe(false);
  });

  it('prevents duplicate unlock submission in ApiKeyModal while in flight (SEC-F012)', async () => {
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    cryptoVault.lock();

    const pendingUnlock = deferred<boolean>();
    const unlockSpy = vi.spyOn(useAppStore.getState(), 'unlockVault').mockReturnValueOnce(pendingUnlock.promise);

    useAppStore.getState().openApiKeyModal();
    render(<ApiKeyModal />);

    fireEvent.change(screen.getByPlaceholderText('ENTER MASTER PASSWORD...'), {
      target: { value: 'long-test-passphrase-2026' },
    });

    const unlockBtn = screen.getByRole('button', { name: /UNLOCK/i }) as HTMLButtonElement;
    fireEvent.click(unlockBtn);
    fireEvent.click(unlockBtn);

    expect(unlockSpy).toHaveBeenCalledTimes(1);
    expect(unlockBtn.disabled).toBe(true);

    await act(async () => {
      pendingUnlock.resolve(true);
      await Promise.resolve();
    });
    expect(unlockBtn.disabled).toBe(false);
  });

  it('rejects invalid machineId values before calling fetch in instaboxClient (SEC-F013)', async () => {
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    const profileId = await cryptoVault.addProfile('Prod', 'ibk_test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(instaboxClient.getMachine(profileId, '../other')).rejects.toThrow('Invalid machine identifier');
    await expect(instaboxClient.controlMachine(profileId, 'm_1%2fbad', 'start')).rejects.toThrow('Invalid machine identifier');
    await expect(instaboxClient.getProcesses(profileId, 'm_1?x=1')).rejects.toThrow('Invalid machine identifier');

    const execErrors: string[] = [];
    await instaboxClient.streamExec(
      profileId,
      '../exec-escape',
      { cmd: 'id' },
      vi.fn(),
      vi.fn(),
      vi.fn(),
      (err) => execErrors.push(err.message)
    );
    expect(execErrors).toEqual(['Invalid machine identifier']);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
