import React, { useState } from 'react';
import { Tile, Countdown, Chip, NUMERIC } from '../ui/index.ts';
import { SurvivalDriverSheet } from './SurvivalDriverSheet.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import { submitSurvivalPick } from '../../services/firestoreService.ts';
import { isEventLocked } from '../../utils/survival.ts';
import type {
  Constructor, Driver, Event, SurvivalConfig, SurvivalPicksDoc, SurvivalStandings, User,
} from '../../types.ts';

interface Props {
  user: User;
  config: SurvivalConfig;
  standings: SurvivalStandings | null;
  myPicks: SurvivalPicksDoc;
  round: Event | null;
  rounds: Event[];
  isFinal: boolean;
  drivers: Driver[];
  constructors: Constructor[];
  formLocks: { [eventId: string]: boolean };
  eventName: (id: string | null) => string;
}

const Message: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <Tile padding="md">
    <h3 className="text-sm font-black uppercase italic tracking-wide text-pure-white">{title}</h3>
    <p className="mt-1.5 text-xs leading-relaxed text-highlight-silver">{body}</p>
  </Tile>
);

export const SurvivalRoundCard: React.FC<Props> = ({
  user, config, standings, myPicks, round, rounds, isFinal, drivers, constructors, formLocks, eventName,
}) => {
  const { showToast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!config.entrants.includes(user.id)) {
    return <Message title="Not entered" body="Entry closed when the challenge started. Only members whose dues were paid at that moment are in." />;
  }
  const me = standings?.players[user.id];
  if (me && !me.alive) {
    const how = me.reason === 'missed' ? 'no valid pick' : me.reason === 'final' ? 'beaten in the final round' : 'driver missed the podium';
    return <Message title={`Eliminated · ${eventName(me.eliminatedAt)}`} body={`Out on ${how}. You can still follow the rest of the challenge below.`} />;
  }
  if (standings?.status === 'complete') return null;
  if (!round) return <Message title="Waiting on results" body="Every round has been played. Standings update as soon as results are entered." />;

  const locked = isEventLocked(round, formLocks);
  const current = myPicks[round.id]?.driverId ?? null;
  const currentDriver = drivers.find(d => d.id === current);

  // Uses spent on other rounds that are still part of the challenge.
  const roundIds = new Set(rounds.map(r => r.id));
  const usage: { [driverId: string]: number } = {};
  Object.entries(myPicks).forEach(([eid, p]) => {
    if (eid !== round.id && roundIds.has(eid) && p?.driverId) usage[p.driverId] = (usage[p.driverId] || 0) + 1;
  });

  const choose = async (driverId: string) => {
    setSheetOpen(false);
    setSaving(true);
    try {
      await submitSurvivalPick(round.id, driverId);
      showToast('Survival pick locked in.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not save your pick.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tile padding="md" accent="gp" accentEdge>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black uppercase italic tracking-wide text-pure-white">{round.name}</h3>
            {isFinal && <Chip label="Final round" tone="warning" size="xs" />}
          </div>
          <p className="mt-1 text-xs text-highlight-silver">
            {isFinal ? 'Highest finisher among the survivors wins.' : 'Pick one driver to finish P1–P3 in the Grand Prix.'}
          </p>
        </div>
        {!locked && <Countdown targetDate={round.lockAtUtc} size="sm" label="Locks in" />}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-pure-white/10 bg-carbon-black/40 px-3 py-3">
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">Your pick</span>
          <span className="block truncate text-lg font-black italic text-pure-white">{currentDriver?.name ?? 'No pick yet'}</span>
        </div>
        {locked ? (
          <Chip label={current ? 'Locked' : 'Locked · no pick'} tone={current ? 'neutral' : 'danger'} size="sm" />
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => setSheetOpen(true)}
            className="rounded-lg bg-primary-red px-4 py-2 text-[11px] font-black uppercase tracking-wider text-on-primary transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : current ? 'Change pick' : 'Make pick'}
          </button>
        )}
      </div>
      {!locked && !current && (
        <p className="mt-2 text-[11px] text-primary-red">No pick by lock means elimination.</p>
      )}
      <p className={`mt-3 text-[11px] text-highlight-silver ${NUMERIC}`}>
        Each driver can be picked 3 times in the whole challenge.
      </p>

      <SurvivalDriverSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        drivers={drivers}
        constructors={constructors}
        usage={usage}
        selectedId={current}
        onSelect={choose}
      />
    </Tile>
  );
};
