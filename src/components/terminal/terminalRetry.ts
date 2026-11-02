import type { TerminalEvent } from '../../../electron/terminalGateway';

export type TerminalFailure = Pick<TerminalEvent, 'category' | 'httpStatus' | 'closeCode' | 'retryAfterMs' | 'at'>;

export function retryDelayMs(failure: TerminalFailure, retryNumber: number, random = Math.random): number | null {
  if (retryNumber < 1 || retryNumber > 3) return null;
  if (!['rate_limit', 'unavailable', 'network'].includes(failure.category ?? '')) return null;
  if ((failure.retryAfterMs ?? 0) > 600_000) return null;
  const base = Math.min(30_000, 1000 * 2 ** (retryNumber - 1));
  const jittered = Math.round(base * (1 + Math.max(0, Math.min(1, random())) * 0.2));
  return Math.max(jittered, failure.retryAfterMs ?? 0);
}

export function describeTerminalFailure(failure: TerminalFailure): string {
  const names: Record<NonNullable<TerminalFailure['category']>, string> = {
    auth: 'Authentication or permission denied', machine: 'Machine state conflict', rate_limit: 'Terminal quota or rate limit',
    unavailable: 'Service temporarily unavailable', network: 'Temporary network failure', taken: 'Session opened elsewhere',
    server: 'Server rejected terminal', protocol: 'Unexpected terminal session signal',
  };
  const category = failure.category ?? 'network';
  const details = [failure.httpStatus ? `HTTP ${failure.httpStatus}` : null,
    failure.closeCode ? `WS ${failure.closeCode}` : null,
    failure.at ? new Date(failure.at).toLocaleTimeString() : null].filter(Boolean).join(' · ');
  return `${names[category]}${details ? ` (${details})` : ''}`;
}
