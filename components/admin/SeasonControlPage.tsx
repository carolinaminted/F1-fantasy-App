import React, { useState } from 'react';
import { Tile, Chip } from '../ui/index.ts';
import { AdminToolShell } from './AdminToolShell.tsx';
import { ConfirmModal } from './ConfirmModal.tsx';
import { CheckeredFlagIcon } from '../icons/CheckeredFlagIcon.tsx';
import { useSeason } from '../../contexts/SeasonContext.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import { concludeSeasonCall, archiveSeasonCall } from '../../services/firestoreService.ts';
import type { SeasonStatus } from '../../services/seasonConfig.ts';
import type { AdminDestination } from '../../routes.ts';

type StepId = 'conclude' | 'archive' | 'backup' | 'start' | 'open';

interface Step {
  id: StepId;
  title: string;
  description: string;
  /** The status this step moves the season out of; the step is current while status equals it. */
  from: SeasonStatus | null;
  /** Steps not built yet render disabled, naming the work item that builds them. */
  comingWith?: string;
}

const STEPS: Step[] = [
  { id: 'conclude', title: 'Conclude season', from: 'active',
    description: 'Once every race has results or is cancelled: fix the champion and podium from the final standings.' },
  { id: 'archive', title: 'Archive season', from: 'concluded',
    description: 'Copy the season into the Hall of Fame, check the copy, and update career stats. Safe to re-run.' },
  { id: 'backup', title: 'Take backup', from: null, comingWith: '[ROLL-05]',
    description: 'Export the whole league database before anything is reset.' },
  { id: 'start', title: 'Start new season', from: null, comingWith: '[ROLL-05]',
    description: 'Reset standings, results and picks, set every member to Unpaid, and enter setup mode.' },
  { id: 'open', title: 'Open season', from: null, comingWith: '[ROLL-07]',
    description: 'With the new calendar in place, open the season to members.' },
];

const STATUS_ORDER: SeasonStatus[] = ['active', 'concluded', 'archived', 'setup'];

const STATUS_TONE: Record<SeasonStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  active: 'success', concluded: 'warning', archived: 'info', setup: 'neutral',
};

interface SeasonControlPageProps {
  setAdminSubPage: (page: AdminDestination) => void;
}

const SeasonControlPage: React.FC<SeasonControlPageProps> = ({ setAdminSubPage }) => {
  const { seasonId, label, status } = useSeason();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState<StepId | null>(null);
  const [busy, setBusy] = useState(false);

  // Archive stays available once archived: re-running refreshes and re-verifies the copy.
  const isCurrent = (step: Step) =>
    step.id === 'archive' ? status === 'concluded' || status === 'archived' : step.from === status;
  const isDone = (step: Step) =>
    step.from !== null && STATUS_ORDER.indexOf(status) > STATUS_ORDER.indexOf(step.from) && !isCurrent(step);

  const run = async () => {
    const step = confirming;
    if (!step) return;
    setBusy(true);
    try {
      if (step === 'conclude') {
        const { champions } = await concludeSeasonCall(seasonId);
        showToast(champions.length > 1
          ? `${label} concluded — ${champions.length} co-champions.`
          : `${label} concluded — champion decided.`, 'success');
      } else {
        const result = await archiveSeasonCall(seasonId);
        if (result.ok) {
          showToast(`Archive verified: ${result.counts.picks} lineups, ${result.counts.standings} standings.`, 'success');
        } else {
          showToast(`Archive check failed (${result.mismatches.length}): ${result.mismatches[0]}`, 'error');
        }
      }
    } catch (error: any) {
      console.error('[SeasonControl]', error);
      showToast(error?.message || 'The request failed.', 'error');
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-2 md:px-0 pb-20 md:pb-12">
      <AdminToolShell
        title="SEASON CONTROL"
        icon={CheckeredFlagIcon}
        subtitle={label}
        setAdminSubPage={setAdminSubPage}
      >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-highlight-silver">Status</span>
        <Chip label={status} tone={STATUS_TONE[status]} size="sm" />
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, i) => {
          const current = isCurrent(step);
          const done = isDone(step);
          const actionable = current && !step.comingWith;
          return (
            <li key={step.id}>
              <Tile padding="md" glow={current}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-highlight-silver">Step {i + 1}</span>
                      {done && <Chip label="Done" tone="success" size="xs" />}
                      {step.comingWith && <Chip label={`Coming with ${step.comingWith}`} tone="neutral" size="xs" />}
                    </div>
                    <h3 className="mt-1 text-base font-black uppercase italic tracking-wide text-pure-white">{step.title}</h3>
                    <p className="mt-1 text-sm text-highlight-silver">{step.description}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!actionable || busy}
                    onClick={() => setConfirming(step.id)}
                    className="shrink-0 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider bg-primary-red text-pure-white disabled:opacity-40"
                  >
                    {step.id === 'archive' && status === 'archived' ? 'Re-run' : 'Run'}
                  </button>
                </div>
              </Tile>
            </li>
          );
        })}
      </ol>
      </AdminToolShell>

      <ConfirmModal
        isOpen={confirming === 'conclude'}
        onClose={() => !busy && setConfirming(null)}
        onConfirm={run}
        title={`Conclude the ${label}`}
        consequence="The champion and podium are fixed from the standings as they are now, and the season moves to concluded. This cannot be undone from the app."
        confirmLabel="Conclude season"
        tone="danger"
        typedGuard={`CONCLUDE ${seasonId}`}
        busy={busy}
        busyLabel="Concluding…"
      />
      <ConfirmModal
        isOpen={confirming === 'archive'}
        onClose={() => !busy && setConfirming(null)}
        onConfirm={run}
        title={`Archive the ${label}`}
        consequence="Copies the season into the Hall of Fame and checks the copy against the live data. Live data is not changed, and it is safe to run again."
        confirmLabel="Archive season"
        tone="warning"
        typedGuard={`ARCHIVE ${seasonId}`}
        busy={busy}
        busyLabel="Archiving…"
      />
    </div>
  );
};

export default SeasonControlPage;
