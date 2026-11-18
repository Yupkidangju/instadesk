export interface TerminalController {
  tileId: string;
  sendInput: (data: string) => boolean;
  focus: () => void;
  clear: () => void;
  reconnect: () => void;
}

class TerminalRegistry {
  private controllers = new Map<string, TerminalController>();

  register(controller: TerminalController): () => void {
    this.controllers.set(controller.tileId, controller);
    return () => {
      if (this.controllers.get(controller.tileId) === controller) {
        this.controllers.delete(controller.tileId);
      }
    };
  }

  has(tileId: string): boolean {
    return this.controllers.has(tileId);
  }

  sendToTile(tileId: string, data: string): boolean {
    const controller = this.controllers.get(tileId);
    if (!controller) return false;
    return controller.sendInput(data);
  }

  sendToTiles(tileIds: Iterable<string>, data: string): number {
    let sent = 0;
    const seen = new Set<string>();
    for (const tileId of tileIds) {
      if (seen.has(tileId)) continue;
      seen.add(tileId);
      if (this.sendToTile(tileId, data)) sent += 1;
    }
    return sent;
  }

  mirrorInput(sourceTileId: string, data: string, syncedTileIds: Iterable<string>): number {
    let sent = 0;
    for (const tileId of syncedTileIds) {
      if (tileId === sourceTileId) continue;
      if (this.sendToTile(tileId, data)) sent += 1;
    }
    return sent;
  }

  focusTile(tileId: string): boolean {
    const controller = this.controllers.get(tileId);
    if (!controller) return false;
    controller.focus();
    return true;
  }

  clearAll(): void {
    for (const controller of this.controllers.values()) {
      controller.clear();
    }
  }

  reconnectAll(): void {
    for (const controller of this.controllers.values()) {
      controller.reconnect();
    }
  }
}

export const terminalRegistry = new TerminalRegistry();
