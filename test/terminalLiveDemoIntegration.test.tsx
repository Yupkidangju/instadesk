import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../src/store/useAppStore';
import { cryptoVault } from '../src/services/cryptoVault';
import { instaboxClient } from '../src/services/instaboxClient';
import { WorkspaceGrid } from '../src/components/WorkspaceGrid';
import { terminalHistoryCache } from '../src/components/terminal/terminalHistoryCache';

const xtermProbe = vi.hoisted(() => ({
  instances: [] as Array<{
    writes: string[];
    onDataCallback?: (data: string) => void;
    clearCount: number;
    resetCount: number;
  }>,
}));

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    buffer = { active: { baseY: 0, viewportY: 0 } };
    writes: string[] = [];
    onDataCallback?: (data: string) => void;
    clearCount = 0;
    resetCount = 0;
    constructor() {
      xtermProbe.instances.push(this);
    }
    loadAddon() {}
    open() {}
    focus() {}
    writeln(value: string) {
      this.writes.push(`${value}\n`);
    }
    write(value: string, cb?: () => void) {
      this.writes.push(value);
      cb?.();
    }
    clear() {
      this.clearCount += 1;
      this.writes = [];
    }
    reset() {
      this.resetCount += 1;
      this.writes = [];
    }
    dispose() {}
    onData(cb: (data: string) => void) {
      this.onDataCallback = cb;
    }
    onResize() {}
    scrollLines() {}
  },
}));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: class {} }));
vi.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: class {
    serialize() {
      return 'cached-banner-line\n';
    }
  },
}));

describe('live demo TerminalView + SessionCommandBar integration (IMP-F012, DBG-F018, SEC-F011)', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    xtermProbe.instances.length = 0;
    terminalHistoryCache.clear();
    cryptoVault.resetVault();
    useAppStore.getState().clearAllTiles();
    useAppStore.setState({
      isDemoMode: true,
      machines: await instaboxClient.listMachines('demo-default'),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    terminalHistoryCache.clear();
    useAppStore.getState().clearAllTiles();
    cryptoVault.resetVault();
  });

  it('executes multi-char commands and Y/ESC quick replies in real demo TerminalView with full traffic-light transitions', async () => {
    const store = useAppStore.getState();
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal', 'main');
    const [tile] = useAppStore.getState().tiles;

    render(<WorkspaceGrid />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(useAppStore.getState().sessionActivities[tile.tileId]?.status).toBe('idle');
    expect(screen.getByText('● 1 IDLE')).toBeDefined();

    // 1. LIVE PTY COMMAND 입력으로 'apt' 실행 -> 🟡 PROMPT 전이
    const cmdInput = screen.getByPlaceholderText('LIVE PTY COMMAND (ENTER TO SEND TO TARGETS)...');
    fireEvent.change(cmdInput, { target: { value: 'apt' } });
    fireEvent.click(screen.getByText('SEND'));

    expect(useAppStore.getState().sessionActivities[tile.tileId]?.status).toBe('prompt');
    expect(screen.getByText('▲ 1 PROMPT')).toBeDefined();
    expect(screen.getByText(/Do you want to continue\? \[Y\/n\]/)).toBeDefined();

    // 2. 빠른 응답 'Y' 클릭 -> 🔴 RUN 전이 -> 350ms 후 🟢 IDLE 복귀
    fireEvent.click(screen.getAllByRole('button', { name: 'Y' })[0]);
    expect(useAppStore.getState().sessionActivities[tile.tileId]?.status).toBe('running');
    expect(screen.getByText('● 1 RUN')).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(useAppStore.getState().sessionActivities[tile.tileId]?.status).toBe('idle');
    expect(screen.getByText('● 1 IDLE')).toBeDefined();

    // 3. 'confirm' 후 ESC 빠른 응답 -> 취소 후 🟢 IDLE 복귀
    fireEvent.change(cmdInput, { target: { value: 'confirm' } });
    fireEvent.click(screen.getByText('SEND'));
    expect(useAppStore.getState().sessionActivities[tile.tileId]?.status).toBe('prompt');

    fireEvent.click(screen.getByRole('button', { name: 'ESC' }));
    expect(useAppStore.getState().sessionActivities[tile.tileId]?.status).toBe('idle');
    expect(xtermProbe.instances[0].writes.join('')).toContain('Cancelled.');
  });

  it('blocks keystroke mirroring when a synced terminal is at a sudo password prompt (SEC-F011)', async () => {
    const store = useAppStore.getState();
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal', 'main');
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal', 'agent');
    const [t1, t2] = useAppStore.getState().tiles;
    store.setSyncedTiles([t1.tileId, t2.tileId]);
    store.setKeystrokeMirroring(true);

    render(<WorkspaceGrid />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    const term1 = xtermProbe.instances[0];
    const term2 = xtermProbe.instances[1];
    expect(term1).toBeDefined();
    expect(term2).toBeDefined();

    // t1에서 sudo 입력 -> 미러링이 켜져 있으므로 t2로 미러링되지만 둘 다 sudo 프롬프트(isSensitive) 진입
    // t1을 직접 sudo로 전환시킨 뒤 비밀번호 입력 시 t2로 평문 비밀번호가 복제되지 않아야 함
    act(() => {
      term1.onDataCallback?.('sudo\r');
    });
    expect(useAppStore.getState().sessionActivities[t1.tileId]?.isSensitive).toBe(true);
    const writesBeforeSecret = term2.writes.join('');

    act(() => {
      term1.onDataCallback?.('my_secret_pw\r');
    });
    expect(term2.writes.join('')).toBe(writesBeforeSecret);
  });

  it('does not re-save or restore stale history on manual RECONNECT (DBG-F018)', async () => {
    const store = useAppStore.getState();
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal', 'main');
    const [tile] = useAppStore.getState().tiles;

    render(<WorkspaceGrid />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    fireEvent.click(screen.getByTitle('Reconnect Terminal Session'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(terminalHistoryCache.get(tile.tileId, 'main')).toBeNull();
    const lastInstance = xtermProbe.instances[xtermProbe.instances.length - 1];
    expect(lastInstance.writes.join('')).not.toContain('cached-banner-line');
  });
});
