// src/components/SidebarVmList.tsx
import React from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Search,
  Terminal,
  Monitor,
  Play,
  Pause,
  Power,
  Trash2,
  Server,
  Layers,
} from 'lucide-react';
import { InstaboxMachine, MachineState } from '../types/instabox';

export const SidebarVmList: React.FC = () => {
  const {
    machines,
    searchQuery,
    setSearchQuery,
    stateFilter,
    setStateFilter,
    profileFilter,
    setProfileFilter,
    profiles,
    addTile,
    controlMachine,
    deleteMachine,
  } = useAppStore();

  // 필터링 적용
  const filteredMachines = machines.filter((m) => {
    // 1. 검색어 필터
    if (
      searchQuery &&
      !m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !m.id.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    // 2. 상태 필터
    if (stateFilter !== 'all') {
      if (stateFilter === 'running' && m.state !== 'running') return false;
      if (stateFilter === 'suspended' && m.state !== 'suspended') return false;
      if (stateFilter === 'stopped' && m.state !== 'stopped') return false;
    }
    // 3. 프로필 필터
    if (profileFilter !== 'all' && m.profileId !== profileFilter) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (state: MachineState) => {
    switch (state) {
      case 'running':
        return (
          <span className="neo-tag text-emerald-400 border-emerald-900/80 bg-emerald-950/40">
            ● RUNNING
          </span>
        );
      case 'suspended':
        return (
          <span className="neo-tag text-amber-400 border-amber-900/80 bg-amber-950/40">
            ▲ PAUSED
          </span>
        );
      case 'stopped':
        return (
          <span className="neo-tag text-zinc-400 border-zinc-800 bg-zinc-900">
            ■ STOPPED
          </span>
        );
      case 'starting':
      case 'resuming':
        return (
          <span className="neo-tag text-cyan-400 border-cyan-900/80 bg-cyan-950/40 animate-pulse">
            ◌ BOOTING
          </span>
        );
      default:
        return (
          <span className="neo-tag text-zinc-500 border-zinc-800">
            {state.toUpperCase()}
          </span>
        );
    }
  };

  const handleAction = async (e: React.MouseEvent, m: InstaboxMachine, action: 'start' | 'stop' | 'suspend' | 'resume') => {
    e.stopPropagation();
    await controlMachine(m.id, m.profileId, action);
  };

  const handleDelete = async (e: React.MouseEvent, m: InstaboxMachine) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to permanently delete machine ${m.name}? This cannot be undone.`)) {
      await deleteMachine(m.id, m.profileId, m.name);
    }
  };

  return (
    <aside className="w-80 flex-shrink-0 bg-zinc-950/90 border-r border-zinc-800 flex flex-col h-full overflow-hidden select-none">
      {/* 1. 사이드바 헤더 및 인덱스 */}
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 font-mono text-xs font-bold tracking-wider text-zinc-300">
            <span className="text-swiss-red">02</span>
            <span>//</span>
            <span>NODE_INVENTORY</span>
          </div>
          <span className="neo-tag text-zinc-400">
            {filteredMachines.length} / {machines.length}
          </span>
        </div>

        {/* 검색창 */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="FILTER BY NAME OR ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-xs font-mono pl-8 pr-2 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        {/* 상태 필터 칩 */}
        <div className="flex items-center space-x-1">
          {(['all', 'running', 'suspended', 'stopped'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStateFilter(filter)}
              className={`flex-1 py-1 font-mono text-[10px] uppercase font-bold tracking-wider border transition-colors ${
                stateFilter === filter
                  ? 'border-zinc-500 bg-zinc-800 text-white'
                  : 'border-zinc-900 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* 프로필 선택기 */}
        {profiles.length > 1 && (
          <div className="flex items-center space-x-1 border border-zinc-800 bg-zinc-900 px-2 py-1">
            <Layers className="w-3 h-3 text-zinc-500" />
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="bg-transparent font-mono text-[11px] text-zinc-300 w-full focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">ALL WORKSPACES</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-200">
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2. 머신 카드 리스트 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredMachines.length === 0 ? (
          <div className="py-12 text-center text-zinc-600 font-mono text-xs space-y-2">
            <Server className="w-6 h-6 mx-auto text-zinc-700" />
            <p>NO NODES FOUND</p>
          </div>
        ) : (
          filteredMachines.map((m) => {
            const isRunning = m.state === 'running';
            const isSuspended = m.state === 'suspended';
            const isStopped = m.state === 'stopped';

            return (
              <div
                key={`${m.profileId}-${m.id}`}
                onClick={() => addTile(m.id, m.profileId, 'terminal')}
                className="group border border-zinc-800 bg-zinc-950 p-2.5 hover:border-zinc-600 transition-all cursor-pointer relative"
              >
                {/* 상단 라인: 상태 & 프로필 라벨 */}
                <div className="flex items-center justify-between mb-1.5">
                  {getStatusBadge(m.state)}
                  <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[120px]">
                    {m.profileLabel}
                  </span>
                </div>

                {/* 머신 이름 & ID */}
                <div className="flex items-baseline justify-between">
                  <h4 className="font-mono font-bold text-sm text-zinc-100 group-hover:text-swiss-red transition-colors tracking-tight truncate">
                    {m.name}
                  </h4>
                </div>
                <div className="font-mono text-[10px] text-zinc-500 mb-2 truncate">
                  ID: {m.id}
                </div>

                {/* 메타 스펙 바 */}
                <div className="flex items-center space-x-2 font-mono text-[10px] text-zinc-400 bg-zinc-900/70 p-1 border border-zinc-900 mb-2.5">
                  <span>{m.spec.vcpus} vCPU</span>
                  <span>·</span>
                  <span>{Math.round(m.spec.memMiB / 1024)} GiB</span>
                  <span>·</span>
                  <span>{m.spec.persistentDiskGiB}G SSD</span>
                </div>

                {/* 하단 제어 버튼 행 */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-900">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addTile(m.id, m.profileId, 'terminal');
                      }}
                      title="Open Terminal Pane"
                      className="neo-btn px-2 py-0.5 text-[10px] hover:text-white"
                    >
                      <Terminal className="w-3 h-3 mr-1 text-emerald-400" />
                      TERM
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addTile(m.id, m.profileId, 'desktop');
                      }}
                      title="Open Desktop Screen Stream"
                      className="neo-btn px-2 py-0.5 text-[10px] hover:text-white"
                    >
                      <Monitor className="w-3 h-3 mr-1 text-swiss-red" />
                      DESK
                    </button>
                  </div>

                  {/* 전원 제어 아이콘 */}
                  <div className="flex items-center space-x-1">
                    {isRunning && (
                      <button
                        onClick={(e) => handleAction(e, m, 'suspend')}
                        title="Pause / Suspend"
                        className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Pause className="w-3 h-3" />
                      </button>
                    )}
                    {isSuspended && (
                      <button
                        onClick={(e) => handleAction(e, m, 'resume')}
                        title="Resume"
                        className="p-1 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    )}
                    {isStopped && (
                      <button
                        onClick={(e) => handleAction(e, m, 'start')}
                        title="Start"
                        className="p-1 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    )}
                    {isRunning && (
                      <button
                        onClick={(e) => handleAction(e, m, 'stop')}
                        title="Stop / Shutdown"
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                      >
                        <Power className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, m)}
                      title="Terminate Machine"
                      className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. 사이드바 푸터 */}
      <div className="p-2.5 border-t border-zinc-800 font-mono text-[10px] text-zinc-500 flex items-center justify-between">
        <span>STATUS: READY</span>
        <span>TCP/WSS GATEWAY</span>
      </div>
    </aside>
  );
};
