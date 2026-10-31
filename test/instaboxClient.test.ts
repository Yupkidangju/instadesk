// test/instaboxClient.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { instaboxClient, getApiBaseUrl } from '../src/services/instaboxClient';
import { cryptoVault } from '../src/services/cryptoVault';

describe('InstaboxClient & Simulation', () => {
  beforeEach(() => {
    cryptoVault.resetVault();
  });

  it('should resolve base API URL properly', () => {
    const url = getApiBaseUrl();
    expect(url).toBeDefined();
  });

  it('should list demo machines without real network calls', async () => {
    const machines = await instaboxClient.listMachines('demo-default', '00 // DEMO_SWISS');
    expect(machines.length).toBeGreaterThanOrEqual(4);

    const first = machines[0];
    expect(first.id).toContain('m_demo_');
    expect(first.state).toBe('running');
    expect(first.profileId).toBe('demo-default');
  });

  it('should support lifecycle controls on demo machines', async () => {
    const machines = await instaboxClient.listMachines('demo-default');
    const target = machines[0];

    // Suspend
    await instaboxClient.controlMachine('demo-default', target.id, 'suspend');
    let updated = await instaboxClient.getMachine('demo-default', target.id);
    expect(updated.state).toBe('suspended');

    // Resume
    await instaboxClient.controlMachine('demo-default', target.id, 'resume');
    updated = await instaboxClient.getMachine('demo-default', target.id);
    expect(updated.state).toBe('running');
  });

  it('should stream execution in simulation mode', async () => {
    const stdoutChunks: string[] = [];
    let exitCode = -1;

    await new Promise<void>((resolve) => {
      instaboxClient.streamExec(
        'demo-default',
        'm_demo_swiss_web_01',
        { cmd: 'uname -a' },
        (stdout) => stdoutChunks.push(stdout),
        () => {},
        (res) => {
          exitCode = res.exitCode;
          resolve();
        },
        () => resolve()
      );
    });

    expect(stdoutChunks.join('')).toContain('Linux');
    expect(exitCode).toBe(0);
  });

  it('should generate desktop stream link and access ticket', async () => {
    const link = await instaboxClient.createDesktopStreamLink('demo-default', 'm_demo_swiss_web_01');
    expect(link.url).toBeDefined();
    expect(link.expiresAt).toBeDefined();

    const ticket = await instaboxClient.createAccessTicket('demo-default', 'm_demo_swiss_web_01', 'terminal');
    expect(ticket.token).toBe('demo-ticket-token-ok');
    expect(ticket.protocol).toBe('instabox-terminal.v1');
  });
});
