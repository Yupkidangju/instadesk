// src/components/modals/MasterUnlockModal.tsx
import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { cryptoVault, MAX_FAILED_UNLOCK_ATTEMPTS } from '../../services/cryptoVault';
import { Lock, Shield, Unlock, X } from 'lucide-react';

export const MasterUnlockModal: React.FC = () => {
  const {
    isUnlockModalOpen,
    closeUnlockModal,
    isVaultInitialized,
    unlockVault,
    initializeVault,
  } = useAppStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const failedAttempts = isVaultInitialized ? cryptoVault.getFailedUnlockAttempts() : 0;

  useEffect(() => {
    if (!isUnlockModalOpen) {
      setPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
    }
  }, [isUnlockModalOpen]);

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    closeUnlockModal();
  };

  if (!isUnlockModalOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 15) {
      setPassword('');
      setConfirmPassword('');
      setErrorMsg('Master passphrase must be at least 15 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setPassword('');
      setConfirmPassword('');
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await initializeVault(password);
      setPassword('');
      setConfirmPassword('');
      closeUnlockModal();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to initialize vault');
      setPassword('');
      setConfirmPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const ok = await unlockVault(password);
      if (ok) {
        setPassword('');
        closeUnlockModal();
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Invalid master password');
      setPassword('');
      setConfirmPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono text-xs">
      <div className="max-w-md w-full bg-zinc-950 border border-zinc-700 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          {isVaultInitialized ? (
            <div className="flex items-center space-x-2 text-amber-400 font-bold">
              <Lock className="w-4 h-4" />
              <span className="text-sm">VAULT LOCKED // AUTH REQUIRED</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-emerald-400 font-bold">
              <Shield className="w-4 h-4" />
              <span className="text-sm">VAULT INITIALIZATION // CREATE MASTER KEY</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-zinc-400 text-xs leading-relaxed">
          {isVaultInitialized
            ? `The requested operation requires decrypting an API key. Enter your master password to unlock the local vault. Stored vault data is automatically erased after ${MAX_FAILED_UNLOCK_ATTEMPTS} failed attempts.`
            : 'No master key is configured yet. Create a master passphrase of at least 15 characters to encrypt and protect your local API keys.'}
        </p>

        {isVaultInitialized && failedAttempts > 0 && (
          <div className="p-2 bg-amber-950/60 border border-amber-800 text-amber-300 font-bold">
            Failed unlock attempts: {failedAttempts} / {MAX_FAILED_UNLOCK_ATTEMPTS} (
            {MAX_FAILED_UNLOCK_ATTEMPTS - failedAttempts} remaining before stored data is erased)
          </div>
        )}

        {errorMsg && (
          <div className="p-2 bg-red-950 border border-red-800 text-red-300 font-bold">
            [ERROR] {errorMsg}
          </div>
        )}

        {isVaultInitialized ? (
          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              autoFocus
              placeholder="ENTER MASTER PASSWORD..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              required
            />

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="neo-btn flex-1 py-2 text-zinc-400 hover:text-white"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="neo-btn-primary flex-1 py-2 flex items-center justify-center space-x-1"
              >
                <Unlock className="w-3.5 h-3.5 mr-1" />
                <span>{isSubmitting ? 'VERIFYING...' : 'UNLOCK VAULT'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="password"
              autoFocus
              placeholder="CREATE MASTER PASSPHRASE (MIN 15 CHARS)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              required
            />
            <input
              type="password"
              placeholder="CONFIRM MASTER PASSPHRASE"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              required
            />

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="neo-btn flex-1 py-2 text-zinc-400 hover:text-white"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="neo-btn-primary flex-1 py-2 flex items-center justify-center space-x-1"
              >
                <Shield className="w-3.5 h-3.5 mr-1" />
                <span>{isSubmitting ? 'CREATING...' : 'CREATE VAULT'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
