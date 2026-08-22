import React, { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '../icons/ChevronDownIcon.tsx';
import { ProfileIcon } from '../icons/ProfileIcon.tsx';
import { functions } from '../../services/firebase.ts';
import { httpsCallable } from '@firebase/functions';
import type { User } from '../../types.ts';

interface AccountMenuProps {
  user: User;
  onEditProfile: () => void;
}

/**
 * The "Manage Account" dropdown from the Profile header. Extracted in Gate 12; the
 * password-reset callable and its cooldown behave exactly as before.
 */
export const AccountMenu: React.FC<AccountMenuProps> = ({ user, onEditProfile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePasswordReset = async () => {
    if (resetCooldown || isResetting) return;
    setResetStatus(null);
    setIsResetting(true);
    try {
      const sendResetLink = httpsCallable(functions, 'sendPasswordResetLink');
      await sendResetLink({ email: user.email });
      setResetStatus({ type: 'success', message: `Password reset link sent to ${user.email}` });
      setResetCooldown(true);
      setTimeout(() => setResetCooldown(false), 60000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setResetStatus({
        type: 'error',
        message: err.code === 'functions/resource-exhausted'
          ? 'Too many attempts. Please wait a few minutes.'
          : 'Failed to send reset email. Please try again later.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 rounded-xl border border-pure-white/20 bg-carbon-black/80 px-4 py-2 text-xs font-bold text-pure-white shadow-lg backdrop-blur-md transition-all hover:border-primary-red/50 active:scale-95 md:text-sm"
      >
        <span>Manage Account</span>
        <ChevronDownIcon className={`w-4 h-4 text-highlight-silver transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-pure-white/20 bg-carbon-fiber py-1.5 shadow-2xl backdrop-blur-md animate-fade-in-down">
          <button
            onClick={() => { onEditProfile(); setIsOpen(false); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-pure-white transition-colors hover:bg-pure-white/10"
          >
            <ProfileIcon className="w-4 h-4 text-primary-red" />
            <span>Edit Details</span>
          </button>

          <div className="my-1 h-px bg-pure-white/10" />

          {isResetting ? (
            <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-primary-red">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Sending Reset Link…</span>
            </div>
          ) : resetCooldown ? (
            <div className="px-4 py-2.5 text-xs font-semibold text-green-400">✓ Reset Link Sent</div>
          ) : (
            <button
              onClick={handlePasswordReset}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-highlight-silver transition-colors hover:bg-pure-white/10 hover:text-pure-white"
            >
              <span className="w-4 text-center font-mono">🔑</span>
              <span>Reset Password</span>
            </button>
          )}

          {resetStatus && (
            <div className="mt-1 border-t border-pure-white/10 px-4 py-2 text-[10px]">
              <p className={`font-semibold ${resetStatus.type === 'success' ? 'text-green-400' : 'text-primary-red'}`}>
                {resetStatus.message}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
