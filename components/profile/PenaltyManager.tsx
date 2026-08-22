import React, { useEffect, useState } from 'react';
import { AdminIcon } from '../icons/AdminIcon.tsx';
import { NUMERIC } from '../ui/index.ts';

interface PenaltyManagerProps {
  eventId: string;
  currentPenalty: number;
  currentReason?: string;
  onSave: (eventId: string, penalty: number, reason: string) => Promise<void>;
}

/**
 * Admin-only penalty controls, rendered inside a history row when the parent supplies
 * `onUpdatePenalty`. Moved out of ProfilePage in Gate 12; the save path is unchanged.
 */
export const PenaltyManager: React.FC<PenaltyManagerProps> = ({
  eventId, currentPenalty, currentReason, onSave,
}) => {
  const [penaltyPercent, setPenaltyPercent] = useState<string | number>(currentPenalty * 100);
  const [reason, setReason] = useState(currentReason || '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state if props change (parent refresh, or navigating between events).
  useEffect(() => {
    setPenaltyPercent(currentPenalty * 100);
    setReason(currentReason || '');
  }, [currentPenalty, currentReason]);

  const handleSave = async () => {
    setIsSaving(true);
    const val = Number(penaltyPercent);
    await onSave(eventId, (isNaN(val) ? 0 : val) / 100, reason);
    setIsSaving(false);
  };

  const handleClear = async () => {
    if (!window.confirm('Clear this penalty?')) return;
    setIsSaving(true);
    setPenaltyPercent(0);
    setReason('');
    await onSave(eventId, 0, '');
    setIsSaving(false);
  };

  return (
    <div className="mt-4 rounded-lg border border-primary-red/30 bg-primary-red/[0.08] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary-red">
          <AdminIcon className="w-4 h-4" /> Penalty Tribunal
        </h4>
        <div className="flex items-center gap-2">
          <label className="hidden text-[10px] font-bold uppercase text-highlight-silver sm:block">
            Deduction
          </label>
          <div className="flex items-center gap-1 rounded border border-pure-white/15 bg-carbon-black px-2 py-1 transition-colors focus-within:border-primary-red">
            <input
              type="number" min="0" max="100"
              value={penaltyPercent}
              onChange={e => setPenaltyPercent(e.target.value)}
              className={`w-10 bg-transparent text-right text-sm text-pure-white focus:outline-none ${NUMERIC}`}
            />
            <span className="text-xs font-bold text-highlight-silver">%</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
            Reason / Infraction
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Late Submission"
            className="w-full rounded border border-pure-white/15 bg-carbon-black px-2.5 py-1.5 text-sm text-pure-white focus:border-primary-red focus:outline-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded bg-primary-red px-4 py-2 text-xs font-bold text-pure-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? 'Applying…' : 'Apply Penalty'}
          </button>
          <button
            onClick={handleClear}
            disabled={isSaving}
            type="button"
            className="rounded bg-green-600 px-4 py-2 text-xs font-bold text-pure-white transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};
