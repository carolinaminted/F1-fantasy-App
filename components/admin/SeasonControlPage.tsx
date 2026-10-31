import React, { useState } from 'react';
import { Tile, Chip } from '../ui/index.ts';
import { AdminToolShell } from './AdminToolShell.tsx';
import { ConfirmModal } from './ConfirmModal.tsx';
import { CheckeredFlagIcon } from '../icons/CheckeredFlagIcon.tsx';
import { useSeason } from '../../contexts/SeasonContext.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import { concludeSeasonCall, archiveSeasonCall, backupLeagueCall, startNewSeasonCall, openSeasonCall } from '../../services/firestoreService.ts';
import type { SeasonStatus } from '../../services/seasonConfig.ts';
import type { AdminDestination } from '../../routes.ts';

type StepId = 'conclude' | 'archive' | 'backup' | 'start' | 'open';

interface Step {
  id: StepId;
  title: string;
  description: string;
  /** The status this step moves the season out of; the step is current while status equals it. */
  from: SeasonStatus;
}

const STEPS: Step[] = [
  { id: 'conclude', title: 'Conclude season', from: 'active',
    description: 'Once every race has results or is cancelled: fix the champion and podium from the final standings.' },
  { id: 'archive', title: 'Archive season', from: 'concluded',
    description: 'Copy the season into the Hall of Fame, check the copy, and update career stats. Safe to re-run.' },
  { id: 'backup', title: 'Take backup', from: 'archived',
    description: 'Export the whole league database before anything is reset. Start new season requires it.' },
  { id: 'start', title: 'Start new season', from: 'archived',
    description: 'Reset standings, results and picks, set every member to Unpaid, and enter setup mode.' },
  { id: 'open', title: 'Open season', from: 'setup',
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
  const nextSeasonId = /^\d{4}$/.test(seasonId) ? String(Number(seasonId) + 1) : '';
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState<StepId | null>(null);
  const [busy, setBusy] = useState(false);

  // Archive stays available once archived: re-running refreshes and re-verifies the copy.
  const isCurrent = (step: Step) =>
    step.id === 'archive' ? status === 'concluded' || status === 'archived' : step.from === status;
  const isDone = (step: Step) =>
    STATUS_ORDER.indexOf(status) > STATUS_ORDER.indexOf(step.from) && !isCurrent(step);

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
      } else if (step === 'backup') {
        const { outputUri } = await backupLeagueCall(seasonId);
        showToast(`Backup saved to ${outputUri}`, 'success');
      } else if (step === 'start') {
        const { nextSeasonId: next } = await startNewSeasonCall(seasonId);
        showToast(`${next} season set up. Members see maintenance until you open it.`, 'success');
      } else if (step === 'open') {
        const { scoredEventIds } = await openSeasonCall(seasonId);
        showToast(`${label} is open: ${scoredEventIds.length} races.`, 'success');
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
          return (
            <li key={step.id}>
              <Tile padding="md" glow={current}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-highlight-silver">Step {i + 1}</span>
                      {done && <Chip label="Done" tone="success" size="xs" />}
                    </div>
                    <h3 className="mt-1 text-base font-black uppercase italic tracking-wide text-pure-white">{step.title}</h3>
                    <p className="mt-1 text-sm text-highlight-silver">{step.description}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!current || busy}
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
      <ConfirmModal
        isOpen={confirming === 'backup'}
        onClose={() => !busy && setConfirming(null)}
        onConfirm={run}
        title="Back up the league database"
        consequence="Exports every collection to Cloud Storage. Nothing in the league changes. Take one after the archive, right before starting the new season."
        confirmLabel="Take backup"
        tone="info"
        busy={busy}
        busyLabel="Backing up…"
      />
      <ConfirmModal
        isOpen={confirming === 'start'}
        onClose={() => !busy && setConfirming(null)}
        onConfirm={run}
        title={`Start the ${nextSeasonId} season`}
        consequence={`Turns on maintenance, zeroes the standings, clears every race result, pick lock, cancellation and member lineup, and sets every member to Unpaid. The ${label} archive and career stats are kept. This cannot be undone from the app.`}
        confirmLabel="Start new season"
        tone="danger"
        typedGuard={`START ${nextSeasonId}`}
        busy={busy}
        busyLabel="Setting up…"
      />
      <ConfirmModal
        isOpen={confirming === 'open'}
        onClose={() => !busy && setConfirming(null)}
        onConfirm={run}
        title={`Open the ${label}`}
        consequence="Every race on the new calendar becomes a scored event, maintenance is lifted, and members can make picks. Check the calendar, drivers and scoring first."
        confirmLabel="Open season"
        tone="warning"
        typedGuard={`OPEN ${seasonId}`}
        busy={busy}
        busyLabel="Opening…"
      />
    </div>
  );
};

export default SeasonControlPage;
