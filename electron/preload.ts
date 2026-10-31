import { contextBridge, ipcRenderer } from 'electron';
import type { TerminalEvent, TerminalOpenRequest } from './terminalGateway';
import type { DesktopViewBounds, DesktopViewRequest } from './desktopViewPolicy';
import type { DesktopViewEvent } from './desktopViewGateway';

contextBridge.exposeInMainWorld('instadeskDesktop', Object.freeze({
  isDesktop: true,
  openTerminal: (request: TerminalOpenRequest): Promise<void> => ipcRenderer.invoke('terminal:open', request),
  sendTerminal: (id: string, data: string): Promise<void> => ipcRenderer.invoke('terminal:send', id, data),
  resizeTerminal: (id: string, cols: number, rows: number): Promise<void> => ipcRenderer.invoke('terminal:resize', id, cols, rows),
  closeTerminal: (id: string): Promise<void> => ipcRenderer.invoke('terminal:close', id),
  closeProfile: (profileId: string): Promise<void> => ipcRenderer.invoke('terminal:closeProfile', profileId),
  closeAll: (): Promise<void> => ipcRenderer.invoke('terminal:closeAll'),
  onTerminalEvent: (callback: (event: TerminalEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: TerminalEvent) => callback(value);
    ipcRenderer.on('terminal:event', listener);
    return () => ipcRenderer.removeListener('terminal:event', listener);
  },
  openDesktopView: (request: DesktopViewRequest): Promise<void> => ipcRenderer.invoke('desktop:open', request),
  updateDesktopView: (id: string, bounds: DesktopViewBounds, zoom: number): Promise<void> => ipcRenderer.invoke('desktop:update', id, bounds, zoom),
  closeDesktopView: (id: string): Promise<void> => ipcRenderer.invoke('desktop:close', id),
  onDesktopEvent: (callback: (event: DesktopViewEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: DesktopViewEvent) => callback(value);
    ipcRenderer.on('desktop:event', listener);
    return () => ipcRenderer.removeListener('desktop:event', listener);
  },
}));
