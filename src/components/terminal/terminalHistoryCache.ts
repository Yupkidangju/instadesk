interface HistoryEntry {
  tileId: string;
  profileId: string;
  sessionName: string;
  data: string;
  scrollOffset: number;
  cols: number;
  rows: number;
  bytes: number;
}

const MAX_ENTRY_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 16;

class TerminalHistoryCache {
  private entries = new Map<string, HistoryEntry>();

  private key(tileId: string, sessionName: string): string {
    return `${tileId}\u0000${sessionName}`;
  }

  save(tileId: string, profileId: string, sessionName: string, data: string, scrollOffset: number,
    cols = 80, rows = 24): boolean {
    const key = this.key(tileId, sessionName);
    this.entries.delete(key);
    const bytes = new TextEncoder().encode(data).byteLength;
    if (!data || bytes > MAX_ENTRY_BYTES) return false;
    this.entries.set(key, { tileId, profileId, sessionName, data,
      scrollOffset: Math.max(0, Math.min(1000, Math.floor(scrollOffset))),
      cols: Math.max(1, Math.min(500, Math.floor(cols))),
      rows: Math.max(1, Math.min(300, Math.floor(rows))), bytes });
    while (this.entries.size > MAX_ENTRIES || this.totalBytes() > MAX_TOTAL_BYTES) {
      this.entries.delete(this.entries.keys().next().value!);
    }
    return true;
  }

  get(tileId: string, sessionName: string): Pick<HistoryEntry, 'data' | 'scrollOffset' | 'cols' | 'rows'> | null {
    const key = this.key(tileId, sessionName);
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { data: entry.data, scrollOffset: entry.scrollOffset, cols: entry.cols, rows: entry.rows };
  }

  clearSession(tileId: string, sessionName: string): void {
    this.entries.delete(this.key(tileId, sessionName));
  }

  clearTile(tileId: string): void {
    for (const [key, entry] of this.entries) if (entry.tileId === tileId) this.entries.delete(key);
  }

  clearProfile(profileId: string): void {
    for (const [key, entry] of this.entries) if (entry.profileId === profileId) this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  private totalBytes(): number {
    let total = 0;
    for (const entry of this.entries.values()) total += entry.bytes;
    return total;
  }
}

export const terminalHistoryCache = new TerminalHistoryCache();
