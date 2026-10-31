// src/types/instabox.ts

export type MachineState =
  | 'creating'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'suspending'
  | 'suspended'
  | 'resuming'
  | 'deleting'
  | 'error';

export interface InstaboxMachine {
  id: string;                 // "m_..."
  name: string;
  state: MachineState;
  desiredState?: MachineState;
  operationId: string | null;
  guestUser?: string;
  template?: {
    id: string;
    version: string;
    digest?: string;
  };
  spec: {
    vcpus: number;
    memMiB: number;
    persistentDiskGiB: number;
    rootDiskGiB?: number;
  };
  runtime?: {
    ready: boolean;
  };
  autoSuspendAfterSeconds: number | null;
  metadata: Record<string, string>;
  createdAt: string;
  // 클라이언트 매핑 메타데이터
  profileId: string;
  profileLabel: string;
}

export interface DesktopStatus {
  installed: boolean;
  installing?: boolean;
  running: boolean;
  width?: number;
  height?: number;
  controller?: 'agent' | 'human';
  yours?: boolean;
}

export interface DesktopStreamLink {
  url: string;                // "https://dashboard.instabox.sh/desktop/m_...#token=..."
  expiresAt: string;          // RFC 3339
}

export interface AccessTicket {
  url: string;                // WebSocket URI
  protocol?: string;          // WebSocket subprotocol
  token?: string;             // Short-lived ticket (60s)
  watchUrl?: string;
  expiresAt: string;
}

export interface ExecRequest {
  cmd?: string;
  argv?: string[];
  cwd?: string;
  envs?: Record<string, string>;
  stdin?: string;
  timeoutSeconds?: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  truncated: boolean;
  signal?: number;
}

export interface MachineMetricSample {
  timestamp: string;
  cpuUsedPct: number;
  memUsedBytes: number;
  memTotalBytes: number;
  netRxBytesSec?: number;
  netTxBytesSec?: number;
}

export interface MachineMetricsResponse {
  metrics: MachineMetricSample[];
}

export interface MachineLogsResponse {
  machineId: string;
  state: string;
  console: string;
  cursor: number;
  operations: Array<{
    id: string;
    type: string;
    state: string;
    createdAt: string;
    error?: {
      code: string;
      message: string;
    };
  }>;
}

export interface ProcessItem {
  pid: number;
  ppid: number;
  user: string;
  cpuPct: number;
  memPct: number;
  elapsedSec: number;
  args: string;
}

export interface ProcessListResponse {
  machineId: string;
  state: string;
  live: boolean;
  capturedAt: string;
  processes: ProcessItem[];
}

export type WorkspacePanelType = 'terminal' | 'desktop' | 'exec' | 'logs' | 'processes';

export interface WorkspaceTile {
  tileId: string;
  machineId: string;
  profileId: string;
  activeTab: WorkspacePanelType;
  terminalSessionName: string; // 기본값 "main"
  desktopViewOnly: boolean;
}

export type GridMode = '1x1' | '2x1' | '2x2' | 'auto';
