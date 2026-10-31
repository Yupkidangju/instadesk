// src/components/WorkspaceGrid.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { VmTilePane } from './VmTilePane';
import { LayoutGrid, Terminal } from 'lucide-react';

export const WorkspaceGrid: React.FC = () => {
  const { tiles, gridMode, machines, addTile, openApiKeyModal, enableDemoMode, isDemoMode } = useAppStore();
  const [focusedTileId, setFocusedTileId] = useState<string | null>(null);

  const getGridClasses = () => {
    switch (gridMode) {
      case '1x1':
        return 'grid-cols-1 grid-rows-1';
      case '2x1':
        return 'grid-cols-1 md:grid-cols-2 grid-rows-1';
      case '2x2':
        return 'grid-cols-1 md:grid-cols-2 grid-rows-2';
      case 'auto':
      default:
        if (tiles.length <= 1) return 'grid-cols-1 grid-rows-1';
        if (tiles.length === 2) return 'grid-cols-1 md:grid-cols-2 grid-rows-1';
        return 'grid-cols-1 md:grid-cols-2 grid-rows-2';
    }
  };

  if (tiles.length === 0) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-8 bg-[#09090b] text-center font-mono select-none">
        <div className="max-w-lg w-full p-8 border border-zinc-800 bg-zinc-950 space-y-5 shadow-2xl">
          <div className="w-14 h-14 border border-zinc-700 bg-zinc-900 text-swiss-red flex items-center justify-center mx-auto shadow-inner">
            <LayoutGrid className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-black text-swiss-red tracking-widest uppercase">
              03 // WORKSPACE_EMPTY_STATE
            </div>
            <h3 className="text-lg font-black text-zinc-100 uppercase tracking-tight">
              {machines.length === 0 ? 'NO INSTABOX NODES CONNECTED' : 'WORKSPACE READY // SELECT NODES'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
              {machines.length === 0
                ? 'Register your real instabox.sh API key (ibk_...) to discover your microVMs, or activate simulation demo mode.'
                : 'Choose a node from the left inventory to open real-time PTY terminal and 60fps live desktop stream.'}
            </p>
          </div>

          {machines.length === 0 ? (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={openApiKeyModal}
                className="neo-btn-primary w-full sm:w-auto px-6 py-2.5 text-xs flex items-center justify-center space-x-1.5"
              >
                <span>CONNECT REAL API KEY (ibk_...)</span>
              </button>
              {!isDemoMode && (
                <button
                  onClick={enableDemoMode}
                  className="neo-btn w-full sm:w-auto px-4 py-2.5 text-xs text-zinc-300 hover:text-white"
                >
                  <span>TRY DEMO MODE</span>
                </button>
              )}
            </div>
          ) : (
            <div className="pt-3 border-t border-zinc-800 flex flex-col space-y-2">
              <span className="text-[11px] text-zinc-500 font-bold tracking-wider uppercase">
                AVAILABLE NODES ({machines.length}):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {machines.slice(0, 4).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => addTile(m.id, m.profileId, 'terminal')}
                    className="p-2 border border-zinc-800 bg-zinc-900 hover:border-zinc-600 text-left transition-colors flex items-center justify-between"
                  >
                    <div className="truncate">
                      <div className="font-bold text-xs text-zinc-200 truncate">{m.name}</div>
                      <div className="text-[10px] text-zinc-500">{m.spec.vcpus} vCPU · {m.spec.memMiB}MB</div>
                    </div>
                    <Terminal className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const focusedTile = tiles.find((tile) => tile.tileId === focusedTileId) ?? tiles[0];
  const displayTiles = gridMode === '1x1' ? [focusedTile] : tiles;

  return (
    <main className="flex-1 h-full w-full bg-[#09090b] p-2 overflow-hidden flex flex-col">
      {gridMode === '1x1' && tiles.length > 1 && (
        <nav aria-label="Focused workspace" className="flex gap-1 mb-2 overflow-x-auto">
          {tiles.map((tile) => (
            <button key={tile.tileId} type="button" onClick={() => setFocusedTileId(tile.tileId)}
              className={`neo-btn px-2 py-1 text-xs whitespace-nowrap ${focusedTile.tileId === tile.tileId ? 'text-white border-swiss-red' : 'text-zinc-400'}`}>
              {machines.find((machine) => machine.id === tile.machineId && machine.profileId === tile.profileId)?.name ?? tile.machineId}
            </button>
          ))}
        </nav>
      )}
      <div className={`grid ${getGridClasses()} gap-2 flex-1 w-full h-full overflow-hidden`}>
        {displayTiles.map((tile) => (
          <VmTilePane key={tile.tileId} tile={tile} index={tiles.indexOf(tile)} />
        ))}
      </div>
    </main>
  );
};
