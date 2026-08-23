import React, { useEffect, useState } from 'react';
import { Modal, NUMERIC } from '../ui/index.ts';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  /**
   * One plain sentence saying what actually happens, in the admin's language rather than
   * the system's. This is the whole point of the component — "Are you sure?" tells nobody
   * anything, while "This deletes the results for Monaco and recalculates everyone's
   * points" lets a reader decide.
   */
  consequence: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'info';
  /**
   * For actions that cannot be undone: the exact text the admin has to type before the
   * confirm button becomes usable. Reserved for permanent deletion of someone's data.
   */
  typedGuard?: string;
  busy?: boolean;
  busyLabel?: string;
  /** Extra detail — a document path, a list of what's affected. */
  children?: React.ReactNode;
}

const TONE = {
  danger:  { button: 'bg-primary-red hover:bg-red-600 text-pure-white', accent: 'text-primary-red' },
  warning: { button: 'bg-amber-500 hover:bg-amber-400 text-carbon-black', accent: 'text-amber-400' },
  info:    { button: 'bg-pure-white/15 hover:bg-pure-white/25 text-pure-white', accent: 'text-highlight-silver' },
} as const;

/**
 * The one confirmation dialog for the admin surface.
 *
 * Before this, sixteen hand-rolled modals gave contradictory levels of friction: locking
 * every member out of the league was a single unconfirmed click, while deleting one
 * invitation code took two. Routing every destructive action through here is what makes
 * the friction match the blast radius.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, onClose, onConfirm, title, consequence, confirmLabel, cancelLabel = 'Cancel',
  tone = 'danger', typedGuard, busy, busyLabel, children,
}) => {
  const [typed, setTyped] = useState('');
  const tokens = TONE[tone];

  // A fresh dialog must never open with the previous answer still typed in.
  useEffect(() => { if (isOpen) setTyped(''); }, [isOpen]);

  const guardSatisfied = !typedGuard || typed.trim() === typedGuard.trim();
  const canConfirm = guardSatisfied && !busy;

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? undefined : onClose}
      title={title}
      size="sm"
      urgent={tone === 'danger'}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-pure-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-highlight-silver transition-colors hover:text-pure-white disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { if (canConfirm) onConfirm(); }}
            disabled={!canConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tokens.button}`}
          >
            {busy ? (busyLabel ?? 'Working…') : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ghost-white">{consequence}</p>

      {children && <div className="mt-3">{children}</div>}

      {typedGuard && (
        <div className="mt-4 border-t border-pure-white/10 pt-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-highlight-silver">
            Type <span className={`${tokens.accent} ${NUMERIC}`}>{typedGuard}</span> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-pure-white/15 bg-carbon-black px-3 py-2 text-sm text-pure-white focus:border-primary-red focus:outline-none"
          />
        </div>
      )}
    </Modal>
  );
};
