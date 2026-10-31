export interface DesktopBridge {
  readonly isDesktop: true;
}

declare global {
  interface Window {
    instadeskDesktop?: DesktopBridge;
  }
}
