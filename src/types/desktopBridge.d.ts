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
    type: 'open' | 'data' | 'error' | 'close';
    data?: string | Uint8Array;
  }) => void): () => void;
  openDesktopView(request: {
    id: string;
    profileId: string;
    url: string;
    bounds: { x: number; y: number; width: number; height: number };
  }): Promise<void>;
  updateDesktopView(id: string, bounds: { x: number; y: number; width: number; height: number }): Promise<void>;
  closeDesktopView(id: string): Promise<void>;
  onDesktopEvent(callback: (event: { id: string; type: 'loaded' | 'error' }) => void): () => void;
}

declare global {
  interface Window {
    instadeskDesktop?: DesktopBridge;
  }
}
