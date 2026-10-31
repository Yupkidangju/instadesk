// src/components/modals/ApiKeyModal.tsx
import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { getTrustedProxyOrigin, instaboxClient, isLocalDevOrigin, setTrustedProxyOrigin, validateTrustedProxyOrigin } from '../../services/instaboxClient';
import {
  Key,
  Shield,
  Trash2,
  X,
  Lock,
  Unlock,
  Plus,
  Globe,
  CheckCircle2,
} from 'lucide-react';

export const ApiKeyModal: React.FC = () => {
  const {
    isApiKeyModalOpen,
    closeApiKeyModal,
    isVaultInitialized,
    isVaultUnlocked,
    initializeVault,
    unlockVault,
    lockVault,
    profiles,
    addProfile,
    removeProfile,
    refreshMachines,
    clearAllTiles,
  } = useAppStore();

  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newProfileLabel, setNewProfileLabel] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [customProxyUrl, setCustomProxyUrl] = useState(getTrustedProxyOrigin() ?? '');
  const [proxyTrusted, setProxyTrusted] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);

  const [isValidating, setIsValidating] = useState(false);
  const [isApplyingProxy, setIsApplyingProxy] = useState(false);
  const needsOwnWorker = typeof window !== 'undefined' &&
    !isLocalDevOrigin(window.location.hostname, window.location.port) && !getTrustedProxyOrigin();

  useEffect(() => {
    if (!isVaultUnlocked) setPendingDelete(null);
  }, [isVaultUnlocked]);

  const handleClose = () => {
    setPendingDelete(null);
    closeApiKeyModal();
  };

  const confirmDelete = () => {
    if (!pendingDelete || !profiles.some((profile) => profile.id === pendingDelete.id && profile.label === pendingDelete.label)) {
      setPendingDelete(null);
      setErrorMsg('The selected profile changed. Choose it again.');
      return;
    }
    try {
      removeProfile(pendingDelete.id);
      setSuccessMsg(`Removed profile ${pendingDelete.label}. This cannot be undone.`);
      setPendingDelete(null);
    } catch (error) {
      setErrorMsg((error as Error).message);
    }
  };

  if (!isApiKeyModalOpen) return null;

  const handleInitVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (masterPassword.length < 6) {
      setErrorMsg('Master password must be at least 6 characters.');
      return;
    }
    if (masterPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    try {
      await initializeVault(masterPassword);
      setSuccessMsg('Encrypted local vault initialized. AES-256-GCM ready.');
      setMasterPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const ok = await unlockVault(masterPassword);
      if (ok) {
        setSuccessMsg('Vault unlocked. API keys decrypted strictly on-demand.');
        setMasterPassword('');
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsValidating(true);

    const cleanKey = newApiKey.trim();
    if (!cleanKey.startsWith('ibk_')) {
      setErrorMsg('InstaBox API key must start with "ibk_".');
      setIsValidating(false);
      return;
    }

    try {
      // 연결 실패는 키 오류의 증거가 아니므로 암호화된 기록을 보존한다.
      const label = newProfileLabel.trim() || 'InstaBox Workspace';
      const id = await addProfile(label, cleanKey);
      setNewProfileLabel('');
      setNewApiKey('');

      try {
        const discovered = await instaboxClient.listMachines(id, label);
        await refreshMachines();
        setSuccessMsg(`[VERIFIED & STORED] Connected to InstaBox API! Discovered ${discovered.length} microVM(s).`);
      } catch (apiErr: unknown) {
        const error = apiErr as Error & { status?: number };
        const reason = error.message || 'Connection check failed';
        const nextStep = error.status
          ? 'Check this key and its InstaBox permissions.'
          : 'Apply your own trusted Worker below, then refresh the machine list.';
        setErrorMsg(`[SAVED ENCRYPTED · CONNECTION UNVERIFIED] ${reason}. ${nextStep}`);
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleApplyProxy = async () => {
    setErrorMsg(null);
    setIsApplyingProxy(true);
    try {
      if (customProxyUrl.trim() && !proxyTrusted) {
        throw new Error('Confirm that you trust the proxy operator with your API key.');
      }
      if (customProxyUrl.trim()) {
        const candidate = validateTrustedProxyOrigin(customProxyUrl);
        const health = await fetch(`${candidate}/health`, {
          method: 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        });
        if (!health.ok) throw new Error('Worker health check failed. No API key was sent.');
        const result = await health.json() as { ok?: boolean; service?: string; allowedOrigin?: string };
        if (result.ok !== true || result.service !== 'instadesk-personal-bridge' || result.allowedOrigin !== window.location.origin) {
          throw new Error('Worker identity or allowed site origin does not match. No API key was sent.');
        }
      }
      const origin = setTrustedProxyOrigin(customProxyUrl);
      instaboxClient.cancelActiveRequests();
      clearAllTiles();
      setSuccessMsg(origin ? `Trusted proxy configured for this page session: ${origin}` : 'Reset to default API origin.');
      void refreshMachines();
    } catch (error) {
      setErrorMsg((error as Error).message);
    } finally {
      setIsApplyingProxy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono text-xs">
      <div className="max-w-xl w-full bg-zinc-950 border border-zinc-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* 모달 헤더 */}
        <div className="h-12 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-swiss-red" />
            <span className="font-extrabold text-sm text-zinc-100 tracking-tight">
              ENCRYPTED KEY VAULT // SECURITY MANAGEMENT
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* 상태 알림 메시지 */}
          {errorMsg && (
            <div className="p-2.5 bg-red-950/80 border border-red-800 text-red-300 font-bold">
              [ERROR] {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-bold flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {successMsg}
            </div>
          )}

          {/* 1. 마스터 패스워드 설정 / 언락 섹션 */}
          <div className="p-3.5 border border-zinc-800 bg-zinc-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-200 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-swiss-red" />
                <span>01 // MASTER PASSWORD & ENCRYPTION</span>
              </span>
              <span className="neo-tag text-emerald-400">
                AES-256-GCM + PBKDF2
              </span>
            </div>

            {!isVaultInitialized ? (
              <form onSubmit={handleInitVault} className="space-y-2">
                <p className="text-zinc-400 text-[11px]">
                  Create a master password to encrypt your API keys. Keys will be stored encrypted in your browser's localStorage and decrypted strictly on-demand.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="password"
                    placeholder="MASTER PASSWORD (MIN 6 CHARS)"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 p-2 text-xs focus:outline-none focus:border-zinc-500"
                    required
                  />
                  <input
                    type="password"
                    placeholder="CONFIRM MASTER PASSWORD"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 p-2 text-xs focus:outline-none focus:border-zinc-500"
                    required
                  />
                </div>
                <button type="submit" className="neo-btn-primary w-full py-1.5">
                  INITIALIZE ENCRYPTED VAULT
                </button>
              </form>
            ) : !isVaultUnlocked ? (
              <form onSubmit={handleUnlock} className="space-y-2">
                <p className="text-amber-400 text-[11px]">
                  Vault is currently locked. Enter your master password to unlock and consume API keys.
                </p>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    placeholder="ENTER MASTER PASSWORD..."
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-800 p-2 text-xs focus:outline-none focus:border-zinc-500"
                    required
                  />
                  <button type="submit" className="neo-btn-primary px-4">
                    <Unlock className="w-3.5 h-3.5 mr-1" />
                    UNLOCK
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between text-zinc-300">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Vault unlocked. Keys are safe and decrypted on-demand only.</span>
                </div>
                <button
                  onClick={lockVault}
                  className="neo-btn px-2 py-1 text-zinc-400 hover:text-white"
                >
                  <Lock className="w-3 h-3 mr-1" />
                  LOCK NOW
                </button>
              </div>
            )}
          </div>

          {/* 2. 새 API 키 등록 폼 */}
          {isVaultUnlocked && (
            <form onSubmit={handleAddKey} className="p-3.5 border border-zinc-800 bg-zinc-900/60 space-y-3">
              <span className="font-bold text-zinc-200 flex items-center space-x-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>02 // REGISTER INSTABOX API KEY</span>
              </span>

              {needsOwnWorker && <div role="note" className="border border-amber-800 bg-amber-950/50 p-2 text-amber-200 text-[11px] leading-relaxed">
                This public site cannot reach InstaBox directly from your browser. Deploy and apply <strong>your own Worker</strong> before checking a real key. If the check fails, the key stays encrypted in your vault.{' '}
                <a href="https://github.com/Yupkidangju/instadesk/blob/main/worker/README.md" target="_blank" rel="noopener noreferrer" className="underline">Personal Worker guide</a>
              </div>}

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="PROFILE LABEL (e.g., Personal Org, Production Agent)"
                  value={newProfileLabel}
                  onChange={(e) => setNewProfileLabel(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 p-2 text-xs focus:outline-none focus:border-zinc-500"
                />
                <input
                  type="password"
                  placeholder="INSTABOX API KEY (ibk_...)"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 p-2 text-xs focus:outline-none focus:border-zinc-500"
                  required
                />
              </div>

              <button type="submit" disabled={isValidating} className="neo-btn-primary w-full py-2">
                {isValidating ? 'CHECKING INSTABOX CONNECTION...' : 'ENCRYPT, SAVE & CHECK CONNECTION'}
              </button>
            </form>
          )}

          {/* 2.5 데모 모드 토글 섹션 */}
          <div className="p-3 border border-zinc-800 bg-zinc-900/40 flex items-center justify-between">
            <div>
              <div className="font-bold text-zinc-200">DEMO SIMULATION CLUSTER</div>
              <div className="text-[11px] text-zinc-500">
                Explore terminal, desktop, and broadcast with 4 simulated microVM nodes without real API keys.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const { isDemoMode, enableDemoMode, disableDemoMode } = useAppStore.getState();
                if (isDemoMode) {
                  disableDemoMode();
                  setSuccessMsg('Simulation demo mode deactivated.');
                } else {
                  enableDemoMode();
                  setSuccessMsg('Simulation demo mode activated.');
                }
              }}
              className={`neo-btn px-3 py-1 font-bold ${
                useAppStore.getState().isDemoMode
                  ? 'border-swiss-red bg-swiss-red/20 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {useAppStore.getState().isDemoMode ? 'DEACTIVATE DEMO' : 'ENABLE DEMO'}
            </button>
          </div>

          {/* 3. 등록된 프로필 목록 */}
          <div className="space-y-2">
            <span className="font-bold text-zinc-400 uppercase tracking-wider text-[11px]">
              03 // ENCRYPTED PROFILES ({profiles.length})
            </span>

            {profiles.length === 0 ? (
              <div className="p-4 border border-zinc-800 bg-zinc-950 text-center text-zinc-500">
                No real API profiles registered yet.
              </div>
            ) : (
              profiles.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 border border-zinc-800 bg-zinc-950 flex items-center justify-between"
                >
                  <div>
                    <h5 className="font-bold text-zinc-100">{p.label}</h5>
                    <span className="text-[10px] text-zinc-500">
                      ID: {p.id} · Stored: {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => setPendingDelete({ id: p.id, label: p.label })}
                    title="Remove Profile"
                    disabled={!isVaultUnlocked}
                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
            {pendingDelete && isVaultUnlocked && (
              <div role="alertdialog" aria-label="Confirm profile deletion" className="p-3 border border-red-700 bg-red-950/60 space-y-2">
                <p className="text-red-200">Permanently delete <strong>{pendingDelete.label}</strong> ({pendingDelete.id})? The local encrypted API key cannot be recovered. Its open sessions will close.</p>
                <div className="flex gap-2 justify-end">
                  <button type="button" className="neo-btn px-3 py-1" onClick={() => setPendingDelete(null)}>CANCEL</button>
                  <button type="button" className="neo-btn px-3 py-1 border-red-500 text-red-200" onClick={confirmDelete}>DELETE PROFILE</button>
                </div>
              </div>
            )}
          </div>

          {/* 4. 개인 Worker 연결 설정 */}
          <div id="worker-connection" className="p-3 border border-zinc-800 bg-zinc-900/40 space-y-2">
            <div className="flex items-center space-x-1.5 text-zinc-300 font-bold">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>04 // PERSONAL WORKER CONNECTION</span>
            </div>
            <p className="text-zinc-500 text-[11px] leading-relaxed">
              Demo mode needs no Worker. For real API access, deploy your own Cloudflare Worker and enter its HTTPS origin. Its operator receives your plaintext Bearer API key, commands and responses. The bundled extension is disabled.{' '}
              <a href="https://github.com/Yupkidangju/instadesk/blob/main/worker/README.md" target="_blank" rel="noopener noreferrer" className="underline">Deployment guide</a>
            </p>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="https://your-cors-proxy.workers.dev (optional)"
                value={customProxyUrl}
                onChange={(e) => { setCustomProxyUrl(e.target.value); setProxyTrusted(false); }}
                className="flex-1 bg-zinc-950 border border-zinc-800 p-1.5 text-xs text-zinc-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyProxy}
                disabled={isApplyingProxy}
                className="neo-btn px-3 py-1"
              >
                {isApplyingProxy ? 'CHECKING...' : 'APPLY'}
              </button>
            </div>
            {getTrustedProxyOrigin() && <p className="text-[11px] text-emerald-300">ACTIVE THIS PAGE SESSION: {getTrustedProxyOrigin()}</p>}
            {customProxyUrl.trim() && <label className="flex items-start gap-2 text-amber-300 text-[11px]">
              <input type="checkbox" checked={proxyTrusted} onChange={(e) => setProxyTrusted(e.target.checked)} />
              <span>I control or explicitly trust this proxy with full API key access.</span>
            </label>}
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between flex-shrink-0">
          <span className="text-zinc-500 text-[10px]">
            Local encrypted vault // API keys are sent in plaintext to the selected API origin
          </span>
          <button onClick={handleClose} className="neo-btn px-4 py-1">
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
