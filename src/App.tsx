// src/App.tsx
import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { HeaderBar } from './components/HeaderBar';
import { SidebarVmList } from './components/SidebarVmList';
import { WorkspaceGrid } from './components/WorkspaceGrid';
import { ApiKeyModal } from './components/modals/ApiKeyModal';
import { MasterUnlockModal } from './components/modals/MasterUnlockModal';
import { BroadcastExecModal } from './components/modals/BroadcastExecModal';
import { CreateVmModal } from './components/modals/CreateVmModal';
import { cryptoVault } from './services/cryptoVault';

export const App: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const {
    refreshMachines,
    autoRefreshInterval,
  } = useAppStore();

  // 최초 로드 시 머신 목록 동기화
  useEffect(() => {
    refreshMachines();
  }, []);

  // 주기적 자동 새로고침 타이머
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      if (!useAppStore.getState().isLoadingMachines) void refreshMachines();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  useEffect(() => {
    const onActivity = () => { if (cryptoVault.isUnlocked()) cryptoVault.touch(); };
    window.addEventListener('keydown', onActivity, { capture: true });
    window.addEventListener('pointerdown', onActivity, { capture: true });
    window.addEventListener('touchstart', onActivity, { capture: true });
    return () => {
      window.removeEventListener('keydown', onActivity, { capture: true });
      window.removeEventListener('pointerdown', onActivity, { capture: true });
      window.removeEventListener('touchstart', onActivity, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen]);

  return (
    <div className="flex flex-col h-dvh w-full overflow-hidden bg-[#09090b] text-zinc-100 font-sans">
      {/* 1. 상단 시스템 네비게이션 헤더 */}
      <HeaderBar sidebarOpen={isSidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)} />

      {/* 2. 메인 워크스페이스 본문 (좌: 노드 인벤토리 사이드바, 우: 멀티 타일 분할 그리드) */}
      <div className="relative flex-1 min-h-0 flex w-full overflow-hidden">
        {isSidebarOpen && <button type="button" aria-label="Close node inventory" className="absolute inset-0 z-20 bg-black/70 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        <SidebarVmList isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
        <WorkspaceGrid />
      </div>

      {/* 3. 네오스위스 하단 상태 표시줄 (시스템 푸터) */}
      <footer className="hidden lg:flex min-h-6 bg-zinc-950 border-t border-zinc-800 px-3 items-center justify-between text-[10px] font-mono select-none flex-shrink-0 text-zinc-500">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold">SYSTEMS OPERATIONAL</span>
          </span>
          <span className="text-zinc-700">|</span>
          <span>ELECTRON DESKTOP // DIRECT INSTABOX API</span>
          <span className="text-zinc-700">|</span>
          <span>DEMO READY</span>
        </div>

        <div className="flex items-center space-x-3">
          <span>VAULT: AES-256-GCM + PBKDF2</span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-400">INSTABOX DECK DESKTOP</span>
        </div>
      </footer>

      {/* 4. 전역 모달 컴포넌트들 */}
      <ApiKeyModal />
      <MasterUnlockModal />
      <BroadcastExecModal />
      <CreateVmModal />
    </div>
  );
};
