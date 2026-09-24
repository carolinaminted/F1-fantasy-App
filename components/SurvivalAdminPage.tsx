import React, { useEffect, useMemo, useState } from 'react';
import { Tile, SectionHeader, Chip, NUMERIC } from './ui/index.ts';
import { AdminToolShell, ConfirmModal } from './admin/index.ts';
import { SurvivalIcon } from './icons/SurvivalIcon.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { useSurvival } from '../hooks/useSurvival.ts';
import {
  getAllUsers, resetSurvivalChallenge, saveSurvivalConfig, startSurvivalChallenge,
} from '../services/firestoreService.ts';
import { isEventLocked } from '../utils/survival.ts';
import type { Event, User } from '../types.ts';
import type { AdminDestination } from '../routes.ts';

interface Props {
  setAdminSubPage: (page: AdminDestination) => void;
  user: User | null;
  events: Event[];
  cancelledEventIds: Set<string>;
  formLocks: { [eventId: string]: boolean };
}

const fetchPaidUsers = async (): Promise<User[]> => {
  const all: User[] = [];
  let cursor: any = null;
  do {
    const { users, lastDoc } = await getAllUsers(100, cursor);
    all.push(...users);
    cursor = users.length === 100 ? lastDoc : null;
  } while (cursor);
  return all.filter(u => u.duesPaidStatus === 'Paid');
};

const SurvivalAdminPage: React.FC<Props> = ({ setAdminSubPage, user, events, cancelledEventIds, formLocks }) => {
  const { showToast } = useToast();
  const { config, standings, names } = useSurvival();
  const [paid, setPaid] = useState<User[]>([]);
  const [startEventId, setStartEventId] = useState('');
  const [prize, setPrize] = useState('');
  const [confirm, setConfirm] = useState<'start' | 'reset' | null>(null);
  const [busy, setBusy] = useState(false);

  const running = config?.status === 'active';
  useEffect(() => { setPrize(config?.prize ?? ''); }, [config?.prize]);
  useEffect(() => {
    if (running) return;
    fetchPaidUsers().then(setPaid).catch(err => { console.error(err); showToast('Could not load members.', 'error'); });
  }, [running]);

  const startable = useMemo(
    () => events.filter(e => !cancelledEventIds.has(e.id) && !isEventLocked(e, formLocks)),
    [events, cancelledEventIds, formLocks],
  );
  useEffect(() => { if (!startEventId && startable[0]) setStartEventId(startable[0].id); }, [startable, startEventId]);

  const eventName = (id: string | null | undefined) => events.find(e => e.id === id)?.name ?? '—';
  const aliveCount = config ? config.entrants.filter(u => standings?.players[u]?.alive !== false).length : 0;
  const roundsPlayed = !!standings?.lastProcessedEventId;

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); showToast(ok, 'success'); }
    catch (err: any) { console.error(err); showToast(err?.message || 'Something went wrong.', 'error'); }
    finally { setBusy(false); setConfirm(null); }
  };

  const field = 'w-full rounded-lg border border-pure-white/10 bg-carbon-black/50 px-3 py-2 text-sm text-pure-white focus:border-primary-red focus:outline-none';

  return (
    <AdminToolShell title="Podium Survival" icon={SurvivalIcon} subtitle="Start and run the elimination challenge" setAdminSubPage={setAdminSubPage}>
      <div className="w-full max-w-3xl mx-auto px-2 md:px-0 pb-20 space-y-6">
        <Tile padding="md">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-highlight-silver" htmlFor="survival-prize">Prize</label>
          <div className="mt-2 flex gap-2">
            <input id="survival-prize" className={field} value={prize} maxLength={120} placeholder="To be announced" onChange={e => setPrize(e.target.value)} />
            <button
              type="button" disabled={busy || prize === (config?.prize ?? '')}
              onClick={() => act(() => saveSurvivalConfig({ prize: prize.trim() }), 'Prize saved.')}
              className="rounded-lg border border-pure-white/20 px-4 text-[11px] font-black uppercase tracking-wider text-pure-white hover:border-pure-white/40 disabled:opacity-40"
            >Save</button>
          </div>
        </Tile>

        {!running ? (
          <>
            <Tile padding="md">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-highlight-silver" htmlFor="survival-start">Start race</label>
              <select id="survival-start" className={`${field} mt-2`} value={startEventId} onChange={e => setStartEventId(e.target.value)}>
                {startable.map(e => <option key={e.id} value={e.id}>R{e.round} · {e.name}</option>)}
              </select>
              <p className="mt-2 text-xs text-highlight-silver">Only races whose picks are still open can start the challenge.</p>
            </Tile>

            <div>
              <SectionHeader title="Entrants" subtitle={`${paid.length} members with dues paid right now`} />
              <Tile padding="md">
                {paid.length
                  ? <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm text-pure-white">{paid.map(u => <li key={u.id} className="truncate">{u.displayName}</li>)}</ul>
                  : <p className="text-xs text-highlight-silver">No paid members yet.</p>}
              </Tile>
            </div>

            <button
              type="button" disabled={busy || !startEventId || paid.length === 0}
              onClick={() => setConfirm('start')}
              className="w-full rounded-lg bg-primary-red px-4 py-3 text-xs font-black uppercase tracking-wider text-on-primary hover:bg-red-600 disabled:opacity-40"
            >Start challenge</button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Started', eventName(config!.startEventId)],
                ['Entrants', String(config!.entrants.length)],
                ['Alive', String(aliveCount)],
              ].map(([label, value]) => (
                <Tile key={label} padding="md" className="text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">{label}</span>
                  <span className={`mt-1 block truncate text-lg font-black italic text-pure-white ${NUMERIC}`}>{value}</span>
                </Tile>
              ))}
            </div>
            <Tile padding="md" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-pure-white">
                  Standings through <strong>{eventName(standings?.lastProcessedEventId)}</strong>
                </span>
                <Chip label={standings?.status === 'complete' ? 'Complete' : 'Live'} tone={standings?.status === 'complete' ? 'neutral' : 'success'} size="xs" />
              </div>
              {standings?.status === 'complete' && (
                <p className="text-sm text-pure-white">
                  {standings.winners.length ? `Winner: ${standings.winners.map(u => names[u] || u).join(', ')}` : 'No winner.'}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button" disabled={busy}
                  onClick={() => act(() => saveSurvivalConfig({}), 'Recompute requested. Standings refresh in a few seconds.')}
                  className="rounded-lg border border-pure-white/20 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-pure-white hover:border-pure-white/40 disabled:opacity-40"
                >Recompute standings</button>
                <button
                  type="button" disabled={busy || roundsPlayed}
                  onClick={() => setConfirm('reset')}
                  title={roundsPlayed ? 'A round has already been scored' : undefined}
                  className="rounded-lg border border-primary-red/50 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-primary-red hover:border-primary-red disabled:opacity-40"
                >Cancel challenge</button>
              </div>
              <p className="text-xs text-highlight-silver">Standings recompute on their own whenever race results or cancellations change. A challenge can only be cancelled before its first round is scored.</p>
            </Tile>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirm === 'start'}
        onClose={() => setConfirm(null)}
        onConfirm={() => act(() => startSurvivalChallenge(startEventId, paid.map(u => u.id), user?.id || '', prize.trim()), 'Podium Survival has started.')}
        title="Start Podium Survival?"
        consequence={`${paid.length} members are entered from ${eventName(startEventId)}. Nobody can join after this.`}
        confirmLabel="Start"
        tone="warning"
        busy={busy}
      />
      <ConfirmModal
        isOpen={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        onConfirm={() => act(resetSurvivalChallenge, 'Challenge cancelled.')}
        title="Cancel the challenge?"
        consequence="Entrants are cleared and standings removed. Picks already submitted stay stored and will count again if the challenge restarts from the same race."
        confirmLabel="Cancel challenge"
        tone="danger"
        busy={busy}
      />
    </AdminToolShell>
  );
};

export default SurvivalAdminPage;
