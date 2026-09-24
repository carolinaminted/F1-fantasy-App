import React from 'react';
import { Tile, SectionHeader, Chip, NUMERIC } from '../ui/index.ts';
import { isEventLocked } from '../../utils/survival.ts';
import type { Driver, Event, SurvivalConfig, SurvivalPicksDoc, SurvivalRound, SurvivalStandings } from '../../types.ts';

interface Props {
  config: SurvivalConfig;
  standings: SurvivalStandings | null;
  picks: { [uid: string]: SurvivalPicksDoc };
  names: { [uid: string]: string };
  rounds: Event[];
  round: Event | null;
  drivers: Driver[];
  formLocks: { [eventId: string]: boolean };
  currentUserId: string;
}

const OUTCOME_TONE: Record<SurvivalRound['outcome'], 'success' | 'danger' | 'warning'> = {
  survived: 'success', won: 'warning', eliminated: 'danger', missed: 'danger',
};

export const SurvivalBoard: React.FC<Props> = ({
  config, standings, picks, names, rounds, round, drivers, formLocks, currentUserId,
}) => {
  const code = (id: string | null) => {
    if (!id) return '—';
    const d = drivers.find(x => x.id === id);
    return d ? d.name.split(' ').slice(-1)[0].slice(0, 3).toUpperCase() : id.toUpperCase();
  };
  const name = (uid: string) => names[uid] || 'Unknown Team';
  const roundOpenPicksHidden = round ? !isEventLocked(round, formLocks) : true;
  const roundIndex = (eid: string | null) => rounds.findIndex(r => r.id === eid);

  const rows = config.entrants.map(uid => ({ uid, player: standings?.players[uid] }));
  const alive = rows.filter(r => !r.player || r.player.alive)
    .sort((a, b) => name(a.uid).localeCompare(name(b.uid)));
  const out = rows.filter(r => r.player && !r.player.alive)
    .sort((a, b) => roundIndex(b.player!.eliminatedAt) - roundIndex(a.player!.eliminatedAt) || name(a.uid).localeCompare(name(b.uid)));

  const Row: React.FC<{ uid: string; dim?: boolean }> = ({ uid, dim }) => {
    const player = standings?.players[uid];
    const played = rounds.filter(r => player?.rounds[r.id]);
    const livePick = round ? picks[uid]?.[round.id]?.driverId ?? null : null;
    return (
      <li className={`flex flex-wrap items-center justify-between gap-2 border-b border-pure-white/5 py-2.5 last:border-0 ${dim ? 'opacity-60' : ''}`}>
        <span className={`truncate text-sm font-bold ${uid === currentUserId ? 'text-primary-red' : 'text-pure-white'}`}>{name(uid)}</span>
        <span className="flex flex-wrap items-center gap-1">
          {played.map(r => {
            const res = player!.rounds[r.id];
            const label = `${code(res.driverId)}${res.position ? ` P${res.position}` : ''}`;
            return <Chip key={r.id} label={<span className={NUMERIC}>{label}</span>} tone={OUTCOME_TONE[res.outcome]} size="xs" />;
          })}
          {!dim && round && !player?.rounds[round.id] && (
            roundOpenPicksHidden
              ? <Chip label={livePick ? 'Picked' : 'Waiting'} tone="neutral" size="xs" />
              : <Chip label={livePick ? code(livePick) : 'No pick'} tone={livePick ? 'info' : 'danger'} size="xs" />
          )}
        </span>
      </li>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <SectionHeader title="Still standing" subtitle={`${alive.length} of ${config.entrants.length}`} />
        <Tile padding="md">
          {alive.length ? <ul>{alive.map(r => <Row key={r.uid} uid={r.uid} />)}</ul>
            : <p className="text-xs text-highlight-silver">Nobody left.</p>}
        </Tile>
      </div>
      <div>
        <SectionHeader title="Eliminated" subtitle={`${out.length}`} />
        <Tile padding="md">
          {out.length ? <ul>{out.map(r => <Row key={r.uid} uid={r.uid} dim />)}</ul>
            : <p className="text-xs text-highlight-silver">Everyone is still in.</p>}
        </Tile>
      </div>
    </div>
  );
};
