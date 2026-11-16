import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExecRunnerView } from '../src/components/terminal/ExecRunnerView';
import { instaboxClient } from '../src/services/instaboxClient';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('stops the local exec stream and discards output when the tab unmounts', async () => {
  let streamSignal: AbortSignal | undefined;
  const stream = vi.spyOn(instaboxClient, 'streamExec').mockImplementation(async (
    _profileId, _machineId, _request, onStdout, _onStderr, _onExit, _onError, signal,
  ) => {
    streamSignal = signal;
    onStdout('temporary output');
    await new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve(), { once: true }));
  });
  const mounted = render(React.createElement(ExecRunnerView, { machineId: 'm_1', profileId: 'p1' }));
  fireEvent.click(screen.getByRole('button', { name: 'RUN' }));
  await waitFor(() => expect(stream).toHaveBeenCalledTimes(1));
  expect(screen.getByText('temporary output')).toBeDefined();
  mounted.unmount();
  expect(streamSignal?.aborted).toBe(true);
  render(React.createElement(ExecRunnerView, { machineId: 'm_1', profileId: 'p1' }));
  expect(screen.queryByText('temporary output')).toBeNull();
});
