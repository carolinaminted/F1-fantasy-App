import React, { useMemo } from 'react';
import { Tile, SectionHeader, Chip, EmptyState, teamColor, withAlpha, NUMERIC } from '../ui/index.ts';
import { GarageIcon } from '../icons/GarageIcon.tsx';
import { CONSTRUCTORS } from '../../constants.ts';
import { EntityClass, type Driver, type Constructor } from '../../types.ts';

/** Official team pages, for the readers who want the real thing. */
const TEAM_URLS: Record<string, string> = {
  'mclaren': 'https://www.formula1.com/en/teams/mclaren',
  'mercedes': 'https://www.formula1.com/en/teams/mercedes',
  'red_bull': 'https://www.formula1.com/en/teams/red-bull-racing',
  'ferrari': 'https://www.formula1.com/en/teams/ferrari',
  'williams': 'https://www.formula1.com/en/teams/williams',
  'racing_bulls': 'https://www.formula1.com/en/teams/racing-bulls',
  'aston_martin': 'https://www.formula1.com/en/teams/aston-martin',
  'haas': 'https://www.formula1.com/en/teams/haas',
  'audi': 'https://www.formula1.com/en/teams/kick-sauber',
  'alpine': 'https://www.formula1.com/en/teams/alpine',
  'cadillac': 'https://www.formula1.com/en/teams/cadillac',
};

interface RosterGridProps {
  allDrivers: Driver[];
  allConstructors: Constructor[];
}

/** Class markers, hoisted so SectionHeader is not handed a fresh component each render. */
const ClassADot: React.FC<React.SVGProps<SVGSVGElement>> = () => (
  <span className="w-2.5 h-2.5 rounded-full bg-primary-red shrink-0" aria-hidden="true" />
);
const ClassBDot: React.FC<React.SVGProps<SVGSVGElement>> = () => (
  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
);

const TeamCard: React.FC<{ team: Constructor; drivers: Driver[] }> = ({ team, drivers }) => {
  const color = teamColor(team.id, [team]) ?? '#888888';
  const url = TEAM_URLS[team.id];
  const Wrapper = url ? 'a' : 'div';

  return (
    <Wrapper
      {...(url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group block"
    >
      <Tile
        padding="sm"
        accent={color}
        accentEdge
        className={`h-full ${url ? 'cursor-pointer hover:border-pure-white/25' : ''}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-pure-white/10 pb-2">
          <h3 className="min-w-0 truncate text-sm font-black uppercase tracking-tight text-pure-white">
            {team.name}
          </h3>
          {url && (
            <svg
              className="w-3 h-3 shrink-0 text-highlight-silver opacity-0 transition-opacity group-hover:opacity-100"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          )}
        </div>

        <div className="mt-2 space-y-1.5">
          {drivers.length > 0 ? (
            drivers.map(driver => (
              <div key={driver.id} className="flex items-center gap-2 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: driver.isActive ? color : withAlpha('#DA291C', 0.9) }}
                  aria-hidden="true"
                />
                <span
                  className={`min-w-0 truncate text-xs font-bold ${
                    driver.isActive
                      ? 'text-ghost-white'
                      : 'text-highlight-silver line-through opacity-60'
                  }`}
                >
                  {driver.name}
                </span>
              </div>
            ))
          ) : (
            <span className="text-[10px] italic text-highlight-silver opacity-50">TBA</span>
          )}
        </div>
      </Tile>
    </Wrapper>
  );
};

/**
 * The grid: every constructor and its line-up, split by the two classes the picks board
 * cares about. Class membership is the reason this page exists — it is what tells you
 * which teams compete for your two Class A slots and which for your one Class B slot.
 */
export const RosterGrid: React.FC<RosterGridProps> = ({ allDrivers, allConstructors }) => {
  const { classA, classB } = useMemo(() => {
    const rank = (id: string) => {
      const i = CONSTRUCTORS.findIndex(c => c.id === id);
      return i === -1 ? 999 : i;
    };
    const sorted = [...allConstructors].sort((a, b) => rank(a.id) - rank(b.id));
    return {
      classA: sorted.filter(c => c.class === EntityClass.A),
      classB: sorted.filter(c => c.class === EntityClass.B),
    };
  }, [allConstructors]);

  const driversFor = (teamId: string) =>
    allDrivers
      .filter(d => d.constructorId === teamId)
      .sort((a, b) => a.name.localeCompare(b.name));

  if (allConstructors.length === 0) {
    return (
      <Tile padding="none">
        <EmptyState
          icon={GarageIcon}
          title="No grid yet"
          description="Constructors and their line-ups appear here once the season is set up."
        />
      </Tile>
    );
  }

  const column = (
    title: string,
    subtitle: string,
    teams: Constructor[],
    dot: React.FC<React.SVGProps<SVGSVGElement>>
  ) => (
    <div>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={
          <Chip
            label={<span className={NUMERIC}>{teams.length} teams</span>}
            tone="neutral"
            size="xs"
          />
        }
        icon={dot}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {teams.map(team => (
          <TeamCard key={team.id} team={team} drivers={driversFor(team.id)} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      {column('Class A', 'Two of your team slots come from here', classA, ClassADot)}
      {column('Class B', 'One team slot, and your two Class B drivers', classB, ClassBDot)}
    </div>
  );
};
