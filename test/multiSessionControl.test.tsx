import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useAppStore, loadPresets } from '../src/store/useAppStore';
import { cryptoVault } from '../src/services/cryptoVault';
import { instaboxClient } from '../src/services/instaboxClient';
import { SessionCommandBar } from '../src/components/SessionCommandBar';
import { VmTilePane } from '../src/components/VmTilePane';
import { WorkspaceGrid } from '../src/components/WorkspaceGrid';
import { DesktopScreenView } from '../src/components/desktop/DesktopScreenView';
import { terminalRegistry } from '../src/components/terminal/terminalRegistry';
import type { DesktopBridge } from '../src/types/desktopBridge';

vi.mock('../src/components/terminal/TerminalView', () => ({
  TerminalView: ({ tileId, sessionName }: { tileId: string; sessionName: string }) => (
    <div data-testid={`mock-term-${tileId}`}>TERM:{sessionName}</div>
  ),
}));

beforeEach(async () => {
  localStorage.removeItem('instabox_deck_presets_v1');
  cryptoVault.resetVault();
  useAppStore.getState().clearAllTiles();
  useAppStore.setState({
    presets: [],
    isDemoMode: true,
    isKeystrokeMirroring: false,
    machines: await instaboxClient.listMachines('demo-default'),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.instadeskDesktop;
  localStorage.removeItem('instabox_deck_presets_v1');
  useAppStore.getState().clearAllTiles();
  cryptoVault.resetVault();
});

describe('multi-session control, traffic-light indicators, and presets', () => {
  it('opens multiple distinct sessions (main, agent, aux) as separate tiles for the same VM', () => {
    const store = useAppStore.getState();
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal');
    const secondId = store.addNextSessionTile('m_demo_swiss_web_01', 'demo-default', 'terminal');
    const thirdId = store.addNextSessionTile('m_demo_swiss_web_01', 'demo-default', 'terminal');
    const fourthId = store.addNextSessionTile('m_demo_swiss_web_01', 'demo-default', 'terminal');

    const tiles = useAppStore.getState().tiles;
    expect(tiles).toHaveLength(3);
    expect(tiles.map((t) => t.terminalSessionName)).toEqual(['main', 'agent', 'aux']);
    expect(secondId).not.toBeNull();
    expect(thirdId).not.toBeNull();
    expect(fourthId).toBeNull();
  });

  it('displays traffic-light states and dispatches live commands only to prompt-waiting or synced sessions', () => {
    const store = useAppStore.getState();
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal', 'main');
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal', 'agent');
    store.addTile('m_demo_swiss_agent_gpu', 'demo-default', 'terminal', 'main');

    const [t1, t2, t3] = useAppStore.getState().tiles;
    store.setSessionActivity(t1.tileId, { status: 'running', updatedAt: 1 });
    store.setSessionActivity(t2.tileId, {
      status: 'prompt',
      summary: 'Allow bash execution? [Y/n]',
      updatedAt: 2,
    });
    store.setSessionActivity(t3.tileId, { status: 'idle', updatedAt: 3 });

    const sent: Record<string, string[]> = { [t1.tileId]: [], [t2.tileId]: [], [t3.tileId]: [] };
    const unsubs = [t1, t2, t3].map((tile) =>
      terminalRegistry.register({
        tileId: tile.tileId,
        sendInput: (data) => {
          sent[tile.tileId].push(data);
          return true;
        },
        focus: vi.fn(),
        clear: vi.fn(),
        reconnect: vi.fn(),
      })
    );

    render(<SessionCommandBar />);

    expect(screen.getByText('● 1 RUN')).toBeDefined();
    expect(screen.getByText('▲ 1 PROMPT')).toBeDefined();
    expect(screen.getByText('● 1 IDLE')).toBeDefined();

    // PROMPTS 스코프로 전환 후 Y 빠른 응답 클릭 -> t2에만 전송되어야 함
    fireEvent.click(screen.getByText('PROMPTS (1)'));
    fireEvent.click(screen.getByText('Y'));
    expect(sent[t1.tileId]).toEqual([]);
    expect(sent[t2.tileId]).toEqual(['y\r']);
    expect(sent[t3.tileId]).toEqual([]);

    // SYNCED 타일(t1, t3)에만 명령 전송
    act(() => {
      useAppStore.getState().setSyncedTiles([t1.tileId, t3.tileId]);
    });
    fireEvent.click(screen.getByText('SYNCED (2)'));
    fireEvent.change(screen.getByPlaceholderText('LIVE PTY COMMAND (ENTER TO SEND TO TARGETS)...'), {
      target: { value: 'pwd' },
    });
    fireEvent.click(screen.getByText('SEND'));
    expect(sent[t1.tileId]).toEqual(['pwd\r']);
    expect(sent[t2.tileId]).toEqual(['y\r']);
    expect(sent[t3.tileId]).toEqual(['pwd\r']);

    unsubs.forEach((u) => u());
  });

  it('mirrors keystrokes across synced tiles excluding the source tile', () => {
    const received: Record<string, string[]> = { a: [], b: [], c: [] };
    const u1 = terminalRegistry.register({
      tileId: 'a',
      sendInput: (d) => { received.a.push(d); return true; },
      focus: vi.fn(), clear: vi.fn(), reconnect: vi.fn(),
    });
    const u2 = terminalRegistry.register({
      tileId: 'b',
      sendInput: (d) => { received.b.push(d); return true; },
      focus: vi.fn(), clear: vi.fn(), reconnect: vi.fn(),
    });
    const u3 = terminalRegistry.register({
      tileId: 'c',
      sendInput: (d) => { received.c.push(d); return true; },
      focus: vi.fn(), clear: vi.fn(), reconnect: vi.fn(),
    });

    const count = terminalRegistry.mirrorInput('a', 'ls\r', ['a', 'b']);
    expect(count).toBe(1);
    expect(received.a).toEqual([]);
    expect(received.b).toEqual(['ls\r']);
    expect(received.c).toEqual([]);

    u1(); u2(); u3();
  });

  it('renders inline prompt banner in VmTilePane and sends quick response', () => {
    const store = useAppStore.getState();
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal', 'agent');
    const [tile] = useAppStore.getState().tiles;
    store.setSessionActivity(tile.tileId, {
      status: 'prompt',
      summary: 'Do you want to continue? [Y/n]',
      updatedAt: Date.now(),
    });

    const sendSpy = vi.fn().mockReturnValue(true);
    const unsub = terminalRegistry.register({
      tileId: tile.tileId,
      sendInput: sendSpy,
      focus: vi.fn(),
      clear: vi.fn(),
      reconnect: vi.fn(),
    });

    render(<VmTilePane tile={tile} index={0} />);
    expect(screen.getByText('▲ PROMPT')).toBeDefined();
    expect(screen.getByText(/Do you want to continue\? \[Y\/n\]/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Y' }));
    expect(sendSpy).toHaveBeenCalledWith('y\r');
    unsub();
  });

  it('saves and restores workspace layout presets without storing secrets and clears live command on lock', async () => {
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    const realProfileId = await cryptoVault.addProfile('Prod', 'ibk_secret_token');
    const store = useAppStore.getState();
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal', 'main');
    store.addTile('m_real_01', realProfileId, 'split', 'agent');
    store.setGridMode('2x2');

    const preset = store.savePreset('AGENT_CLUSTER');
    expect(preset).not.toBeNull();
    expect(localStorage.getItem('instabox_deck_presets_v1')).not.toContain('ibk_secret_token');

    // 잠금 전 명령어 입력 후 잠금 시 입력창이 비워지고 실 프로필 타일이 제거되어야 함
    render(<SessionCommandBar />);
    const input = screen.getByPlaceholderText('LIVE PTY COMMAND (ENTER TO SEND TO TARGETS)...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sensitive-token-cmd' } });
    expect(input.value).toBe('sensitive-token-cmd');

    act(() => {
      cryptoVault.lock();
    });
    expect(input.value).toBe('');
    expect(useAppStore.getState().tiles.map((t) => t.profileId)).toEqual(['demo-default']);

    // 잠금 상태에서 프리셋 복원 시 데모 타일만 복원되고 실 프로필 타일은 복원되지 않아야 함
    act(() => {
      useAppStore.getState().clearAllTiles();
      useAppStore.getState().applyPreset(preset!.id);
    });
    expect(useAppStore.getState().tiles).toHaveLength(1);
    expect(useAppStore.getState().tiles[0].profileId).toBe('demo-default');

    // 잠금 해제 후 프리셋 복원 시 데모 + 실 프로필 타일 모두 복원됨
    await act(async () => {
      await cryptoVault.unlock('long-test-passphrase-2026');
      useAppStore.getState().applyPreset(preset!.id);
    });
    expect(useAppStore.getState().tiles).toHaveLength(2);
    expect(useAppStore.getState().tiles.map((t) => t.terminalSessionName)).toEqual(['main', 'agent']);
    expect(useAppStore.getState().gridMode).toBe('2x2');
  });

  it('prevents duplicate session when switching session inside a tile (IMP-F013)', () => {
    const store = useAppStore.getState();
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal', 'main');
    store.addNextSessionTile('m_demo_swiss_web_01', 'demo-default', 'terminal');
    const [mainTile, agentTile] = useAppStore.getState().tiles;

    store.setTileSessionName(agentTile.tileId, 'main');
    const updated = useAppStore.getState();
    expect(updated.tiles.map((t) => t.terminalSessionName)).toEqual(['main', 'agent']);
    expect(updated.focusedTileId).toBe(mainTile.tileId);
  });

  it('isolates native desktop viewIds per tile for the same VM (DBG-F017)', async () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: ResizeObserverCallback) {}
      observe() { this.callback([{ contentRect: { width: 640, height: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 100, y: 100, left: 100, top: 100, right: 740, bottom: 700,
      width: 640, height: 600, toJSON: () => ({}),
    });
    vi.spyOn(instaboxClient, 'desktopAction').mockResolvedValue({ installed: true, running: true, width: 1280, height: 800 });
    vi.spyOn(instaboxClient, 'createDesktopStreamLink').mockResolvedValue({
      url: 'https://dashboard.instabox.sh/desktop/m_1#signed',
      expiresAt: new Date().toISOString(),
    });
    const openDesktopView = vi.fn().mockResolvedValue(undefined);
    const closeDesktopView = vi.fn().mockResolvedValue(undefined);
    window.instadeskDesktop = {
      isDesktop: true,
      openDesktopView,
      updateDesktopView: vi.fn().mockResolvedValue(undefined),
      closeDesktopView,
      closeAll: vi.fn().mockResolvedValue(undefined),
      onDesktopEvent: vi.fn().mockReturnValue(() => {}),
    } as unknown as DesktopBridge;

    const { rerender } = render(
      <div>
        <DesktopScreenView key="tile-a" tileId="tile-a" machineId="m_1" profileId="p1" viewOnly={true} onViewOnlyChange={vi.fn()} />
        <DesktopScreenView key="tile-b" tileId="tile-b" machineId="m_1" profileId="p1" viewOnly={true} onViewOnlyChange={vi.fn()} />
      </div>
    );

    await vi.waitFor(() => expect(openDesktopView).toHaveBeenCalledTimes(2));
    expect(openDesktopView.mock.calls.map((c) => c[0].id).sort()).toEqual(['desktop_tile-a', 'desktop_tile-b']);

    rerender(
      <div>
        <DesktopScreenView key="tile-b" tileId="tile-b" machineId="m_1" profileId="p1" viewOnly={true} onViewOnlyChange={vi.fn()} />
      </div>
    );
    await vi.waitFor(() => expect(closeDesktopView).toHaveBeenCalledWith('desktop_tile-a'));
    expect(closeDesktopView).not.toHaveBeenCalledWith('desktop_tile-b');
    delete window.instadeskDesktop;
    vi.unstubAllGlobals();
  });

  it('keeps command input on 0 sent, focuses 1x1 jumped tile after mount, and keeps ALL scope (DBG-F019)', async () => {
    const store = useAppStore.getState();
    store.addTile('m_demo_swiss_web_01', 'demo-default', 'terminal', 'main');
    store.addTile('m_demo_swiss_agent_gpu', 'demo-default', 'desktop', 'main');
    store.addTile('m_demo_swiss_db_backup', 'demo-default', 'terminal', 'main');
    const [t1, t2Desktop, t3] = useAppStore.getState().tiles;
    store.setGridMode('1x1');
    store.setFocusedTileId(t1.tileId);

    const focusSpy = vi.fn();
    const unreg1 = terminalRegistry.register({
      tileId: t1.tileId,
      sendInput: () => false, // 아직 미준비 상태 시뮬레이션
      focus: vi.fn(),
      clear: vi.fn(),
      reconnect: vi.fn(),
    });

    render(<WorkspaceGrid />);

    // 1. sent === 0 일 때 입력값 보존
    const input = screen.getByPlaceholderText('LIVE PTY COMMAND (ENTER TO SEND TO TARGETS)...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'keep-me' } });
    fireEvent.click(screen.getByText('SEND'));
    expect(input.value).toBe('keep-me');
    expect(screen.getByText('0/2 PTY READY (INPUT KEPT)')).toBeDefined();

    // 2. 비터미널 탭(t2Desktop) 동기화 시 SYNCED 카운트에서 제외, 이미 1개 동기화된 상태에서 ALL 선택 후 추가 토글 시 ALL 유지
    act(() => {
      useAppStore.getState().toggleTileSync(t1.tileId);
    });
    expect(screen.getByText('SYNCED (1)')).toBeDefined();
    fireEvent.click(screen.getByText('ALL (2)'));
    act(() => {
      useAppStore.getState().toggleTileSync(t2Desktop.tileId);
      useAppStore.getState().toggleTileSync(t3.tileId);
    });
    expect(screen.getByText('SYNCED (2)')).toBeDefined();
    // ALL 스코프가 강제 변경되지 않았는지 확인 (현재 ALL (2) 활성화)
    expect(screen.getByText('ALL (2)').className).toContain('bg-zinc-100');

    // 3. 1x1 모드에서 비포커스 타일(t3) 칩 클릭 후 마운트될 때 포커스 호출
    const unreg3 = terminalRegistry.register({
      tileId: t3.tileId,
      sendInput: () => true,
      focus: focusSpy,
      clear: vi.fn(),
      reconnect: vi.fn(),
    });
    const chips = screen.getAllByRole('button', { name: /box-db-pg-replica:main/ });
    fireEvent.click(chips[0]);
    expect(useAppStore.getState().focusedTileId).toBe(t3.tileId);
    expect(focusSpy).toHaveBeenCalled();

    unreg1();
    unreg3();
  });

  it('sanitizes malformed preset JSON, prompts unlock on locked real preset, and resets mirroring on lock (SEC-F009, SEC-F011)', async () => {
    localStorage.setItem(
      'instabox_deck_presets_v1',
      JSON.stringify([
        { id: 'bad', name: '', tiles: [] },
        {
          id: 'p_mixed',
          name: 'Corruptible',
          gridMode: 'invalid-grid',
          tiles: [
            { machineId: null, profileId: 'demo-default' },
            { machineId: 'm_1', profileId: 'real_p1', activeTab: 'bad-tab', terminalSessionName: 'bad-sess', desktopViewOnly: 'yes' },
            { machineId: 'm_1', profileId: 'real_p1', activeTab: 'split', terminalSessionName: 'bad-sess', desktopViewOnly: true },
          ],
        },
      ])
    );

    const loaded = loadPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].gridMode).toBe('2x1');
    // 중복(real_p1, m_1, main)이 제거되고 열거값이 정규화되어야 함
    expect(loaded[0].tiles).toEqual([
      {
        machineId: 'm_1',
        profileId: 'real_p1',
        activeTab: 'terminal',
        terminalSessionName: 'main',
        desktopViewOnly: false,
      },
    ]);

    // 잠금 상태에서 실 프로필 전용 프리셋 적용 시 잠금 해제/키 등록 모달 오픈
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    cryptoVault.lock();
    useAppStore.setState({ presets: loaded, isUnlockModalOpen: false });
    useAppStore.getState().applyPreset('p_mixed');
    expect(useAppStore.getState().isUnlockModalOpen).toBe(true);

    // 볼트 잠금 및 clearAllTiles 시 isKeystrokeMirroring 초기화
    await cryptoVault.unlock('long-test-passphrase-2026');
    useAppStore.getState().setKeystrokeMirroring(true);
    expect(useAppStore.getState().isKeystrokeMirroring).toBe(true);
    cryptoVault.lock();
    expect(useAppStore.getState().isKeystrokeMirroring).toBe(false);

    useAppStore.getState().setKeystrokeMirroring(true);
    useAppStore.getState().clearAllTiles();
    expect(useAppStore.getState().isKeystrokeMirroring).toBe(false);
  });
});
