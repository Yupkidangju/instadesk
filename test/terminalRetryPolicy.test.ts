import { describe, expect, it } from 'vitest';
import { describeTerminalFailure, retryDelayMs } from '../src/components/terminal/terminalRetry';

describe('PTY retry policy', () => {
  it('retries transient failures at most three times and respects Retry-After', () => {
    const failure = { category: 'rate_limit' as const, retryAfterMs: 2500, httpStatus: 429 };
    expect(retryDelayMs(failure, 1, () => 0)).toBe(2500);
    expect(retryDelayMs(failure, 2, () => 0)).toBe(2500);
    expect(retryDelayMs(failure, 3, () => 0)).toBe(4000);
    expect(retryDelayMs(failure, 4, () => 0)).toBeNull();
    expect(retryDelayMs({ category: 'unavailable' }, 2, () => 0)).toBe(2000);
  });
  it('does not retry auth, machine conflict, taken, exit or protocol error', () => {
    for (const category of ['auth', 'machine', 'taken', 'server', 'protocol'] as const) {
      expect(retryDelayMs({ category }, 1)).toBeNull();
    }
  });
  it('describes only allowlisted diagnostics', () => {
    expect(describeTerminalFailure({ category: 'rate_limit', httpStatus: 429, closeCode: 1006, at: '2026-11-02T00:00:00Z' })).toContain('HTTP 429');
  });
});
