// src/components/modals/MasterUnlockModal.tsx
import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Lock, Unlock, X } from 'lucide-react';

export const MasterUnlockModal: React.FC = () => {
  const { isUnlockModalOpen, closeUnlockModal, unlockVault } = useAppStore();
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isUnlockModalOpen) { setPassword(''); setErrorMsg(null); }
  }, [isUnlockModalOpen]);

  const handleClose = () => { setPassword(''); setErrorMsg(null); closeUnlockModal(); };

  if (!isUnlockModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono text-xs">
      <div className="max-w-md w-full bg-zinc-950 border border-zinc-700 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-amber-400 font-bold">
            <Lock className="w-4 h-4" />
            <span className="text-sm">VAULT LOCKED // AUTH REQUIRED</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-zinc-400 text-xs leading-relaxed">
          The requested operation requires decrypting an API key. Please enter your master password to unlock the local vault.
        </p>

        {errorMsg && (
          <div className="p-2 bg-red-950 border border-red-800 text-red-300 font-bold">
            [ERROR] {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
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
      </div>
    </div>
  );
};
