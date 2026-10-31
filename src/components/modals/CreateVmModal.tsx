// src/components/modals/CreateVmModal.tsx
import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { instaboxClient } from '../../services/instaboxClient';
import { Plus, X, Loader2 } from 'lucide-react';

export const CreateVmModal: React.FC = () => {
  const {
    isCreateVmModalOpen,
    closeCreateVmModal,
    profiles,
    isVaultUnlocked,
    isDemoMode,
    refreshMachines,
    addTile,
  } = useAppStore();

  const [name, setName] = useState('');
  const [profileId, setProfileId] = useState('');
  const [templateId, setTemplateId] = useState('agent-browser');
  const [vcpus, setVcpus] = useState(4);
  const [memMiB, setMemMiB] = useState(8192);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isCreateVmModalOpen) {
      setProfileId(isVaultUnlocked && profiles.length ? profiles[0].id : isDemoMode ? 'demo-default' : '');
      setErrorMsg(null);
    }
  }, [isCreateVmModalOpen]);

  if (!isCreateVmModalOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId || (profileId === 'demo-default' ? !isDemoMode : !isVaultUnlocked || !profiles.some((p) => p.id === profileId))) {
      setErrorMsg('Select an available workspace before creating a VM.');
      return;
    }
    setIsCreating(true);
    setErrorMsg(null);

    try {
      const result = await instaboxClient.createMachine(profileId, {
        name: name.trim() || undefined,
        templateId,
        vcpus,
        memMiB,
      });

      await refreshMachines();
      addTile(result.machineId, profileId, 'terminal');
      closeCreateVmModal();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to create machine');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono text-xs">
      <div className="max-w-md w-full bg-zinc-950 border border-zinc-700 shadow-2xl flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="h-12 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span className="font-extrabold text-sm text-zinc-100 tracking-tight">
              PROVISION NEW MICROVM // LINUX INSTANCE
            </span>
          </div>
          <button
            onClick={closeCreateVmModal}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleCreate} className="p-4 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-red-950 border border-red-800 text-red-300 font-bold">
              [ERROR] {errorMsg}
            </div>
          )}

          {/* 프로필 선택 */}
          {(profiles.length > 0 || isDemoMode) && (
            <div className="space-y-1">
              <label htmlFor="create-vm-profile" className="text-zinc-400 font-bold">TARGET WORKSPACE:</label>
              <select
                id="create-vm-profile"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                {isVaultUnlocked && profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                {isDemoMode && <option value="demo-default">00 // DEMO_SWISS_CLUSTER (SIMULATION)</option>}
              </select>
            </div>
          )}

          {/* 인스턴스 이름 */}
          <div className="space-y-1">
            <label className="text-zinc-400 font-bold">MACHINE NAME (OPTIONAL):</label>
            <input
              type="text"
              placeholder="e.g. box-agent-eval-01 (1-63 chars)"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
              pattern="^[a-z0-9-]*$"
              className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* 템플릿 선택 */}
          <div className="space-y-1">
            <label className="text-zinc-400 font-bold">STARTING TEMPLATE:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTemplateId('agent-browser')}
                className={`p-2.5 border text-left transition-colors ${
                  templateId === 'agent-browser'
                    ? 'border-swiss-red bg-swiss-red/10 text-zinc-100 font-bold'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="text-xs">agent-browser</div>
                <div className="text-[10px] text-zinc-500 font-normal">Desktop GUI + Chromium</div>
              </button>

              <button
                type="button"
                onClick={() => setTemplateId('ci')}
                className={`p-2.5 border text-left transition-colors ${
                  templateId === 'ci'
                    ? 'border-swiss-red bg-swiss-red/10 text-zinc-100 font-bold'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="text-xs">ci (standard)</div>
                <div className="text-[10px] text-zinc-500 font-normal">Lightweight Headless CLI</div>
              </button>
            </div>
          </div>

          {/* 스펙 선택 */}
          <div className="space-y-1">
            <label className="text-zinc-400 font-bold">INSTANCE SPECIFICATION:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 2, m: 4096, label: '2 vCPU / 4G' },
                { v: 4, m: 8192, label: '4 vCPU / 8G' },
                { v: 8, m: 16384, label: '8 vCPU / 16G' },
              ].map((s) => {
                const isSelected = vcpus === s.v && memMiB === s.m;
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      setVcpus(s.v);
                      setMemMiB(s.m);
                    }}
                    className={`p-2 border text-center transition-colors text-xs ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex space-x-2">
            <button
              type="button"
              onClick={closeCreateVmModal}
              className="neo-btn flex-1 py-2 text-zinc-400 hover:text-white"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isCreating || !profileId}
              className="neo-btn-primary flex-1 py-2 flex items-center justify-center space-x-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  <span>PROVISIONING...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>CREATE INSTANCE</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
