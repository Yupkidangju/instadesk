import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('instadeskDesktop', { isDesktop: true });
