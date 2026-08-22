import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from './ui/index.ts';
import { LeagueIcon } from './icons/LeagueIcon.tsx';
import { RosterGrid } from './league/RosterGrid.tsx';
import { DuesStatus } from './league/DuesStatus.tsx';
import { LeagueLinks } from './league/LeagueLinks.tsx';
import { CURRENT_SEASON } from '../constants.ts';
import type { User, Driver, Constructor } from '../types.ts';

interface LeagueHubPageProps {
  user: User | null;
  allDrivers: Driver[];
  allConstructors: Constructor[];
}

/**
 * The League surface.
 *
 * Gate 11 turned this from a menu of six tiles into the content those tiles pointed at.
 * Drivers & Teams, Pay Dues, Donate and Support were four separate routes reached by
 * tapping a card and then tapping again; they are all on this page now, and the dues
 * payment flow opens as a sheet rather than a destination. `?dues=1` opens that sheet, so
 * the retired /dues link still lands exactly where it used to.
 *
 * Membership status rides in the page header rather than taking a full-width card in the
 * body — for most members it is a one-word answer, and the grid is what they came for.
 */
const LeagueHubPage: React.FC<LeagueHubPageProps> = ({ user, allDrivers, allConstructors }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const duesOpen = searchParams.get('dues') === '1';

  const setDues = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set('dues', '1'); else next.delete('dues');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col md:h-full md:overflow-hidden w-full max-w-7xl mx-auto">
      <div className="flex-none">
        <PageHeader
          title="LEAGUE"
          icon={LeagueIcon}
          subtitle={`The ${CURRENT_SEASON} grid, donations, and support`}
          rightAction={
            <DuesStatus
              user={user}
              isOpen={duesOpen}
              onOpen={() => setDues(true)}
              onClose={() => setDues(false)}
            />
          }
        />
      </div>

      <div className="md:flex-1 md:overflow-y-auto custom-scrollbar px-2 md:px-0 pb-24 md:pb-8 pb-safe space-y-8">
        <RosterGrid allDrivers={allDrivers} allConstructors={allConstructors} />

        <LeagueLinks />
      </div>
    </div>
  );
};

export default LeagueHubPage;
