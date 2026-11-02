export interface DesktopBridge {
  readonly isDesktop: true;
  openTerminal(request: { id: string; profileId: string; sessionName: string; url: string; protocols: string[] }): Promise<void>;
  sendTerminal(id: string, data: string): Promise<void>;
  resizeTerminal(id: string, cols: number, rows: number): Promise<void>;
  closeTerminal(id: string): Promise<void>;
  closeProfile(profileId: string): Promise<void>;
  closeAll(): Promise<void>;
  onTerminalEvent(callback: (event: {
    id: string;
    type: 'open' | 'ready' | 'data' | 'error' | 'close' | 'exit';
    data?: string | Uint8Array;
    category?: 'auth' | 'machine' | 'rate_limit' | 'unavailable' | 'network' | 'taken' | 'server' | 'protocol';
    httpStatus?: number;
    retryAfterMs?: number;
    closeCode?: number;
    exitCode?: number;
    at?: string;
  }) => void): () => void;
  openDesktopView(request: {
    id: string;
    profileId: string;
    url: string;
    bounds: { x: number; y: number; width: number; height: number };
    options?: { visible: boolean; routeWheelToWorkspace: boolean };
  }): Promise<void>;
  updateDesktopView(id: string, bounds: { x: number; y: number; width: number; height: number },
    options?: { visible: boolean; routeWheelToWorkspace: boolean }): Promise<void>;
  closeDesktopView(id: string): Promise<void>;
  onDesktopEvent(callback: (event: { id: string; type: 'loaded' | 'error' | 'activity' | 'wheel'; deltaY?: number }) => void): () => void;
}

declare global {
  interface Window {
    instadeskDesktop?: DesktopBridge;
  }
}
