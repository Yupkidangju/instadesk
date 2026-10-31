// src/App.tsx
import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { HeaderBar } from './components/HeaderBar';
import { SidebarVmList } from './components/SidebarVmList';
import { WorkspaceGrid } from './components/WorkspaceGrid';
import { ApiKeyModal } from './components/modals/ApiKeyModal';
import { MasterUnlockModal } from './components/modals/MasterUnlockModal';
import { BroadcastExecModal } from './components/modals/BroadcastExecModal';
import { CreateVmModal } from './components/modals/CreateVmModal';

export const App: React.FC = () => {
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
      refreshMachines();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#09090b] text-zinc-100 font-sans">
      {/* 1. 상단 시스템 네비게이션 헤더 */}
      <HeaderBar />

      {/* 2. 메인 워크스페이스 본문 (좌: 노드 인벤토리 사이드바, 우: 멀티 타일 분할 그리드) */}
      <div className="flex-1 flex w-full h-[calc(100vh-56px-24px)] overflow-hidden">
        <SidebarVmList />
        <WorkspaceGrid />
      </div>

      {/* 3. 네오스위스 하단 상태 표시줄 (시스템 푸터) */}
      <footer className="h-6 bg-zinc-950 border-t border-zinc-800 px-3 flex items-center justify-between text-[10px] font-mono select-none flex-shrink-0 text-zinc-500">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold">SYSTEMS OPERATIONAL</span>
          </span>
          <span className="text-zinc-700">|</span>
          <span>STATIC CLIENT // REAL API NEEDS CORS PATH</span>
          <span className="text-zinc-700">|</span>
          <span>DEMO READY</span>
        </div>

        <div className="flex items-center space-x-3">
          <span>VAULT: AES-256-GCM + PBKDF2</span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-400">INSTABOX DECK v1.0.0</span>
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
