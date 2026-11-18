import { describe, expect, it } from 'vitest';
import {
  SessionActivityTracker,
  detectSessionActivityFromTail,
  stripAnsiAndControl,
} from '../src/components/terminal/sessionActivity';

describe('sessionActivity traffic-light detector', () => {
  it('strips ANSI sequences and preserves spacing on cursor-forward escapes', () => {
    const raw = '\x1b[1;32mAllow\x1b[1Cthis\x1b[1Cedit?\x1b[0m';
    expect(stripAnsiAndControl(raw)).toBe('Allow this edit?');
  });

  it('detects shell prompt return as idle (green)', () => {
    expect(detectSessionActivityFromTail('build complete\nuser@instabox-node:/data/home$ ')).toEqual({
      status: 'idle',
    });
    expect(detectSessionActivityFromTail('root@prod-01:~# ')).toEqual({ status: 'idle' });
    expect(detectSessionActivityFromTail('>>> ')).toEqual({ status: 'idle' });
  });

  it('detects shell confirmation and password prompts as prompt (yellow)', () => {
    const apt = detectSessionActivityFromTail(
      '42.1 MB of additional disk space will be used.\nDo you want to continue? [Y/n] '
    );
    expect(apt.status).toBe('prompt');
    expect(apt.summary).toContain('Do you want to continue? [Y/n]');

    const ssh = detectSessionActivityFromTail(
      'Are you sure you want to continue connecting (yes/no/[fingerprint])? '
    );
    expect(ssh.status).toBe('prompt');

    const sudo = detectSessionActivityFromTail('[sudo] password for user: ');
    expect(sudo.status).toBe('prompt');
    expect(sudo.isSensitive).toBe(true);
    expect(apt.isSensitive).toBeUndefined();
  });

  it('detects AI agent approval and TUI choice menus as prompt (yellow)', () => {
    const agentPrompt = detectSessionActivityFromTail(
      'Claude wants to run Bash: npm test\nDo you want to proceed?\n❯ 1. Yes\n  2. Yes, allow all\n  3. No\nEnter to select'
    );
    expect(agentPrompt.status).toBe('prompt');
    expect(agentPrompt.summary).toBeDefined();

    const numbered = detectSessionActivityFromTail(
      'Choose deployment target:\n1. staging\n2. production'
    );
    expect(numbered.status).toBe('prompt');
    expect(numbered.summary).toContain('Choose deployment target');
  });

  it('transitions cleanly through running -> prompt -> running -> idle', () => {
    const tracker = new SessionActivityTracker();
    tracker.markConnected();
    expect(tracker.getState().status).toBe('idle');

    const afterRun = tracker.recordInput('apt install jq\r');
    expect(afterRun?.status).toBe('running');

    const afterOutput = tracker.recordOutput('Reading package lists...\r\n');
    expect(afterOutput.status).toBe('running');

    const afterPrompt = tracker.recordOutput('Do you want to continue? [Y/n] ');
    expect(afterPrompt.status).toBe('prompt');
    expect(afterPrompt.summary).toContain('[Y/n]');

    const afterReply = tracker.recordInput('y\r');
    expect(afterReply?.status).toBe('running');

    const afterFinish = tracker.recordOutput('Setting up jq...\r\nuser@instabox-node:~$ ');
    expect(afterFinish.status).toBe('idle');
    expect(afterFinish.summary).toBeUndefined();
  });
});
