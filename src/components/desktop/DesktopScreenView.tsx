// src/components/desktop/DesktopScreenView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { instaboxClient } from '../../services/instaboxClient';
import { DesktopStatus } from '../../types/instabox';
import { fitDesktop } from './fitDesktop';
import { useAppStore } from '../../store/useAppStore';
import {
  Monitor,
  Play,
  RefreshCw,
  ExternalLink,
  Eye,
  MousePointer,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface DesktopScreenViewProps {
  machineId: string;
  profileId: string;
  viewOnly: boolean;
  onViewOnlyChange: (viewOnly: boolean) => void;
}

export const DesktopScreenView: React.FC<DesktopScreenViewProps> = ({
  machineId,
  profileId,
  viewOnly,
  onViewOnlyChange,
}) => {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [desktopStatus, setDesktopStatus] = useState<DesktopStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolution, setResolution] = useState<{ width: number; height: number }>({
    width: 1280,
    height: 800,
  });
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [nativeStatus, setNativeStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const modalOpen = useAppStore((state) => state.isApiKeyModalOpen || state.isUnlockModalOpen ||
    state.isBroadcastModalOpen || state.isCreateVmModalOpen);
  const machineState = useAppStore((state) => state.machines.find((machine) =>
    machine.id === machineId && machine.profileId === profileId)?.state);
  const machineReady = !machineState || machineState === 'running';
  const viewId = `desktop_${profileId}_${machineId}`;
  const frameWidth = desktopStatus?.width || resolution.width;
  const frameHeight = desktopStatus?.height || resolution.height;
  const fitted = fitDesktop(frameWidth, frameHeight, viewport.width, viewport.height);
  const viewBounds = () => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || viewport.width < 1 || viewport.height < 1 || rect.width < 1 || rect.height < 1 ||
        fitted.width < 1 || fitted.height < 1) return null;
    const x = Math.max(0, Math.round(rect.left + (rect.width - fitted.width) / 2));
    const y = Math.max(0, Math.round(rect.top + (rect.height - fitted.height) / 2));
    return { x, y, width: Math.max(1, Math.round(fitted.width)), height: Math.max(1, Math.round(fitted.height)) };
  };
  const zoom = Math.max(0.25, Math.min(5, fitted.scale));

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    const rect = element.getBoundingClientRect();
    setViewport({ width: rect.width, height: rect.height });
    return () => observer.disconnect();
  }, []);

  // 데스크톱 상태 및 스트림 URL 로드
  const loadDesktop = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setStreamUrl(null);
    if (!machineReady) {
      setIsLoading(false);
      return;
    }
    try {
      // 1. 데스크톱 상태 확인
      const status = await instaboxClient.desktopAction(profileId, machineId, 'status');
      setDesktopStatus(status);

      // 2. 데스크톱이 이미 실행 중이면 스트림 링크 발급
      if (status.running) {
        const stream = await instaboxClient.createDesktopStreamLink(profileId, machineId, viewOnly);
        setStreamUrl(stream.url);
      } else {
        setStreamUrl(null);
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to check desktop status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDesktop();
  }, [machineId, profileId, viewOnly, machineReady]);

  useEffect(() => {
    const bridge = window.instadeskDesktop;
    const bounds = viewBounds();
    if (!bridge || profileId.startsWith('demo-') || !streamUrl || !desktopStatus?.running ||
        modalOpen || !bounds) return;
    let active = true;
    setNativeStatus('loading');
    const unsubscribe = bridge.onDesktopEvent((event) => {
      if (!active || event.id !== viewId) return;
      setNativeStatus(event.type === 'loaded' ? 'loaded' : 'error');
      if (event.type === 'error') void bridge.closeDesktopView(viewId);
    });
    void bridge.openDesktopView({ id: viewId, profileId, url: streamUrl, bounds, zoom })
      .catch(() => { if (active) setNativeStatus('error'); });
    return () => {
      active = false;
      unsubscribe();
      void bridge.closeDesktopView(viewId);
    };
  }, [streamUrl, profileId, viewId, desktopStatus?.running, modalOpen, viewport.width > 0, viewport.height > 0]);

  useEffect(() => {
    const bridge = window.instadeskDesktop;
    if (!bridge || !streamUrl || modalOpen || profileId.startsWith('demo-')) return;
    const update = () => {
      const bounds = viewBounds();
      if (bounds) void bridge.updateDesktopView(viewId, bounds, zoom);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [streamUrl, viewId, modalOpen, fitted.width, fitted.height, zoom]);

  // 데스크톱 시작 (Xvfb + Xfce + Chromium)
  const handleStartDesktop = async () => {
    setIsStarting(true);
    setErrorMessage(null);
    try {
      const status = await instaboxClient.desktopAction(
        profileId,
        machineId,
        'start',
        resolution.width,
        resolution.height
      );
      setDesktopStatus(status);
      const stream = await instaboxClient.createDesktopStreamLink(profileId, machineId, viewOnly);
      setStreamUrl(stream.url);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to start desktop environment');
    } finally {
      setIsStarting(false);
    }
  };

  // 제어권 인수(Takeover) / 반환(Handback) 토글
  const handleToggleTakeover = async () => {
    if (!machineReady || !desktopStatus?.running) return;
    try {
      const isCurrentlyHuman = desktopStatus.controller === 'human';
      const action = isCurrentlyHuman ? 'handback' : 'takeover';
      const updated = await instaboxClient.desktopAction(profileId, machineId, action);
      setDesktopStatus(updated);
      onViewOnlyChange(isCurrentlyHuman);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] overflow-hidden select-none">
      {/* 데스크톱 상단 툴바 */}
      <div className="min-h-8 bg-zinc-950 border-b border-zinc-800 px-2 py-1 flex flex-wrap items-center justify-between gap-1 text-xs font-mono flex-shrink-0">
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          {machineReady && desktopStatus?.running ? (
            <span className="flex items-center text-emerald-400 space-x-1">
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">XFCE LIVE</span>
            </span>
          ) : (
            <span className="flex items-center text-zinc-500 space-x-1">
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">DESKTOP OFF</span>
            </span>
          )}

          <span className="text-zinc-700">|</span>

          {/* 제어 모드 토글 */}
          <button
            onClick={handleToggleTakeover}
            disabled={!machineReady || !desktopStatus?.running}
            title="Toggle between passive monitoring and human mouse/keyboard control"
            className={`flex items-center space-x-1 px-1.5 py-0.5 border text-[10px] font-bold transition-colors ${
              !viewOnly
                ? 'border-swiss-red bg-swiss-red/20 text-white'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {!viewOnly ? (
              <>
                <MousePointer className="w-3 h-3 text-swiss-red" />
                <span>INTERACTIVE</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 text-zinc-400" />
                <span>VIEW-ONLY</span>
              </>
            )}
          </button>

          {/* 해상도 정보 */}
          <span className="hidden sm:inline text-zinc-500 text-[10px]">
            {frameWidth}x{frameHeight}
          </span>
        </div>

        {/* 우측 툴 액션 */}
        <div className="flex items-center space-x-1">
          {streamUrl && (
            <a
              href={streamUrl}
              target="_blank"
              rel="noreferrer"
              title="Open full stream viewer in new tab"
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button
            onClick={loadDesktop}
            title="Refresh Desktop Stream"
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 에러 바 */}
      {errorMessage && (
        <div className="bg-red-950/60 border-b border-red-800 text-red-300 text-xs font-mono px-3 py-1 flex items-center justify-between">
          <span className="truncate">{errorMessage}</span>
          <button onClick={loadDesktop} className="underline text-[10px] ml-2">
            Retry
          </button>
        </div>
      )}

      {/* 데스크톱 화면 뷰포트 */}
      <div ref={viewportRef} className="flex-1 min-h-0 relative w-full bg-[#050507] flex items-center justify-center overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-2 text-zinc-500 font-mono text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-swiss-red" />
            <span>ESTABLISHING DESKTOP STREAM...</span>
          </div>
        ) : !machineReady ? (
          <div role="status" className="max-w-md p-6 text-center space-y-2 border border-amber-800 bg-amber-950/30 font-mono text-xs text-amber-200">
            <AlertTriangle className="w-6 h-6 mx-auto" />
            <p>VM IS {machineState?.toUpperCase()}</p>
            <p className="text-zinc-400">Resume or start this VM from Node Inventory, then refresh the desktop stream.</p>
          </div>
        ) : !desktopStatus?.running ? (
          /* 데스크톱이 아직 켜지지 않은 경우 */
          <div className="max-w-md w-full p-6 text-center space-y-4 border border-zinc-800 bg-zinc-950 m-4">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <Monitor className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-mono font-bold text-sm text-zinc-100 uppercase tracking-tight">
                DESKTOP ENVIRONMENT OFF
              </h3>
              <p className="font-mono text-xs text-zinc-500">
                Start Xfce desktop, Chromium, and VNC frame server on this microVM.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2">
              {(['1280x800', '1920x1080'] as const).map((res) => {
                const [w, h] = res.split('x').map(Number);
                const isSelected = resolution.width === w && resolution.height === h;
                return (
                  <button
                    key={res}
                    onClick={() => setResolution({ width: w, height: h })}
                    className={`px-2 py-1 text-xs font-mono border ${
                      isSelected
                        ? 'border-zinc-500 bg-zinc-800 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {res}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleStartDesktop}
              disabled={isStarting}
              className="neo-btn-primary w-full py-2"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  STARTING DESKTOP (Xvfb)...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-2 fill-current" />
                  START DESKTOP DISPLAY
                </>
              )}
            </button>
          </div>
        ) : streamUrl ? (
          <div data-desktop-scale={fitted.scale.toFixed(3)} className="relative shrink-0 overflow-hidden border border-zinc-700"
            style={{ width: fitted.width, height: fitted.height }}>
          {profileId.startsWith('demo-') ? (
            /* 데모 모드 시뮬레이션 그래픽 뷰어 */
            <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-zinc-950 font-mono text-xs text-zinc-300">
              <div className="w-full h-full border border-zinc-700 bg-zinc-900 flex flex-col relative overflow-hidden">
                {/* 가상 윈도우 타이틀바 */}
                <div className="h-6 bg-zinc-800 px-3 flex items-center justify-between border-b border-zinc-700">
                  <span className="font-bold text-[11px] text-zinc-300 truncate">
                    InstaBox XFCE Desktop [Chromium + VNC Live Stream Simulator]
                  </span>
                  <div className="flex space-x-1.5">
                    <div className="w-2.5 h-2.5 bg-zinc-600 rounded-full" />
                    <div className="w-2.5 h-2.5 bg-zinc-600 rounded-full" />
                    <div className="w-2.5 h-2.5 bg-swiss-red rounded-full" />
                  </div>
                </div>
                {/* 가상 브라우저 화면 */}
                <div className="flex-1 min-h-0 bg-[#121214] p-2 flex flex-col items-center justify-center text-center gap-1 sm:gap-2">
                  <div className="w-7 h-7 border border-zinc-700 bg-zinc-800 flex items-center justify-center text-swiss-red">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-zinc-100 text-xs">
                    GUI DESKTOP STREAM ACTIVE
                  </div>
                  <p className="text-zinc-500 max-w-sm text-[11px]">
                    Simulated desktop preview. No live InstaBox stream is connected.
                  </p>
                  <div className="neo-tag text-emerald-400 border-emerald-800">
                    DEMO PREVIEW ONLY
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div role="status" className="flex h-full w-full items-center justify-center text-center font-mono text-xs text-zinc-500 p-4">
              {nativeStatus === 'error' ? 'DESKTOP VIEW FAILED — REFRESH OR OPEN EXTERNALLY' :
                nativeStatus === 'loaded' ? 'DESKTOP VIEW ACTIVE' : 'LOADING DESKTOP VIEW...'}
            </div>
          )
            }
          </div>
        ) : (
          <div className="text-center p-6 space-y-2 font-mono text-xs text-zinc-500">
            <AlertTriangle className="w-6 h-6 mx-auto text-amber-500" />
            <p>STREAM LINK NOT AVAILABLE FOR THIS WORKSPACE KEY</p>
            <p className="text-[11px] text-zinc-600">
              Personal keys can mint stream URLs. For workspace keys, use PTY Terminal or direct VNC stream.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
