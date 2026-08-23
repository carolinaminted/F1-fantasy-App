import React, { useEffect, useState } from 'react';
import { User, PickSelection, RaceResults, EntityClass, PointsSystem, Driver, Constructor, Event, LeaderboardCache } from '../types.ts';
import { rankInCategory } from '../utils/categoryRank.ts';
import useFantasyData from '../hooks/useFantasyData.ts';
import { CURRENT_SEASON } from '../constants.ts';
import { getPublicProfileRank } from '../services/firestoreService.ts';
import {
  PageHeader, Tile, StatTile, SectionHeader, Modal, teamColor, type Category,
} from './ui/index.ts';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { AccountMenu } from './profile/AccountMenu.tsx';
import { EditProfileForm } from './profile/EditProfileForm.tsx';
import { UsageSection } from './profile/UsageSection.tsx';
import { HistoryList, type EventCategory } from './profile/HistoryList.tsx';
import type { Page } from '../App.tsx';

interface ProfilePageProps {
  user: User;
  seasonPicks: { [eventId: string]: PickSelection };
  raceResults: RaceResults;
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  setActivePage?: (page: Page, params?: { eventId?: string; search?: string }) => void;
  /** Populated once Standings has been visited; without it the tiles show points alone. */
  leaderboardCache?: LeaderboardCache | null;
  /** If present, enables the admin penalty controls inside the history rows. */
  onUpdatePenalty?: (eventId: string, penalty: number, reason: string) => Promise<void>;
  events: Event[];
  isPublicView?: boolean;
  cancelledEventIds: Set<string>;
}

interface ModalData {
  title: string;
  content: React.ReactNode;
}

const getDriverPoints = (driverId: string | null, results: (string | null)[] | undefined, points: number[]) => {
  if (!driverId || !results) return 0;
  const pos = results.indexOf(driverId);
  return pos !== -1 ? (points[pos] || 0) : 0;
};

/**
 * The Profile surface, rebuilt on the kit in Gate 12.
 *
 * Three callers share this component and their contracts are unchanged: App renders the
 * member's own profile, LeaderboardPage renders it as a public view inside a modal, and
 * AdminUserProfileView renders it with `onUpdatePenalty` to unlock the penalty controls.
 * Every write path — profile update, password reset, penalty save — moved verbatim into
 * `components/profile/`; this file is layout and the read-only detail modals.
 */
const ProfilePage: React.FC<ProfilePageProps> = ({
  user, seasonPicks, raceResults, pointsSystem, allDrivers, allConstructors,
  setActivePage, onUpdatePenalty, events, isPublicView = false, cancelledEventIds, leaderboardCache,
}) => {
  const { scoreRollup, usageRollup, getLimit } = useFantasyData(
    seasonPicks, raceResults, pointsSystem, allDrivers, allConstructors, cancelledEventIds
  );
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Championship rank is league-wide ordering authored by the recalculateEntireLeague
  // Cloud Function. It is NOT computed client-side.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rank = await getPublicProfileRank(user.id);
      if (!cancelled) setGlobalRank(rank);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const getEntityName = (id: string | null): string => {
    if (!id) return 'N/A';
    return allDrivers.find(d => d.id === id)?.name
        ?? allConstructors.find(c => c.id === id)?.name
        ?? 'Unknown';
  };

  /* ------------------------------------------------- read-only detail modals */

  /**
   * Rank is the reader's own standing, and Insights describes the reader — so both only apply
   * when this is your profile. Viewed as an admin or in public view, the tiles keep the
   * per-race modal, which is about the member on screen.
   */
  const showsOwnStanding = !isPublicView && !!setActivePage;
  // Matches breakdown.quali, which is what the league ranks on.
  const qualifyingPoints = scoreRollup.gpQualifyingPoints + scoreRollup.sprintQualifyingPoints;
  const standingFor = (category: Category) =>
    showsOwnStanding ? rankInCategory(leaderboardCache?.users ?? [], user.id, category) : null;

  const handleCategoryClick = (category: Category) => {
    if (showsOwnStanding) {
      setActivePage!('leaderboard', { search: `view=insights&cat=${category}` });
      return;
    }
    handleScoringDetailClick(category);
  };

  const handleScoringDetailClick = (category: Category) => {
    let title = '';
    const detailsContent: React.ReactNode[] = [];
    const relevantEvents = events.filter(
      e => seasonPicks[e.id] && raceResults[e.id] && !cancelledEventIds.has(e.id)
    );

    if (relevantEvents.length === 0) {
      detailsContent.push(
        <p key="no-picks" className="text-center text-highlight-silver">
          No picks submitted for completed events yet.
        </p>
      );
    } else {
      relevantEvents.forEach(event => {
        const picks = seasonPicks[event.id];
        const results = raceResults[event.id];
        const eventEntries: React.ReactNode[] = [];
        let pointSource: (string | null)[] | undefined;
        let pointSystemArr: number[] = [];

        switch (category) {
          case 'gp':
            title = 'Grand Prix Points Breakdown';
            pointSource = results.grandPrixFinish;
            pointSystemArr = pointsSystem.grandPrixFinish;
            break;
          case 'sprint':
            title = 'Sprint Race Points Breakdown';
            pointSource = results.sprintFinish;
            pointSystemArr = pointsSystem.sprintFinish;
            if (!event.hasSprint) return;
            break;
          case 'quali':
            title = 'GP Qualifying Points Breakdown';
            pointSource = results.gpQualifying;
            pointSystemArr = pointsSystem.gpQualifying;
            break;
          case 'fl':
            title = 'Fastest Lap Points Breakdown';
            break;
        }

        if (category === 'fl') {
          if (picks.fastestLap) {
            const points = picks.fastestLap === results.fastestLap ? pointsSystem.fastestLap : 0;
            eventEntries.push(
              <li key="fl">{getEntityName(picks.fastestLap)}: <span className="font-semibold">{points} pts</span></li>
            );
          }
        } else if (pointSource) {
          const allPickedTeams = [...(picks.aTeams || []), picks.bTeam].filter(Boolean) as string[];
          const allPickedDrivers = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean) as string[];

          allPickedTeams.forEach(teamId => {
            let teamPoints = 0;
            allDrivers.forEach(driver => {
              if (driver.constructorId === teamId) {
                teamPoints += getDriverPoints(driver.id, pointSource, pointSystemArr);
              }
            });
            eventEntries.push(
              <li key={`team-${teamId}`}>{getEntityName(teamId)}: <span className="font-semibold">{teamPoints} pts</span></li>
            );
          });

          allPickedDrivers.forEach(driverId => {
            const driverPoints = getDriverPoints(driverId, pointSource, pointSystemArr);
            eventEntries.push(
              <li key={`driver-${driverId}`}>{getEntityName(driverId)}: <span className="font-semibold">{driverPoints} pts</span></li>
            );
          });
        }

        if (eventEntries.length > 0) {
          detailsContent.push(
            <div key={event.id} className="text-center">
              <h4 className="mb-2 font-bold text-primary-red">{event.name}</h4>
              <ul className="list-none space-y-1 text-sm text-ghost-white">{eventEntries}</ul>
            </div>
          );
        }
      });
    }

    if (detailsContent.length === 0 || (detailsContent.length === 1 && (detailsContent[0] as any)?.key === 'no-picks')) {
      detailsContent.push(
        <p key="no-points" className="mt-4 text-center text-highlight-silver">
          No points scored in this category for any completed events.
        </p>
      );
    }

    setModalData({ title, content: <div className="space-y-6">{detailsContent}</div> });
  };

  const handleEventScoringDetailClick = (eventId: string, category: EventCategory) => {
    if (cancelledEventIds.has(eventId)) return;
    const event = events.find(e => e.id === eventId);
    const picks = seasonPicks[eventId];
    const results = raceResults[eventId];
    if (!event || !picks || !results) return;

    let title = '';
    const eventEntries: React.ReactNode[] = [];
    let hasNonZeroPoints = false;
    let pointSource: (string | null)[] | undefined;
    let pointSystemArr: number[] | undefined;

    switch (category) {
      case 'gp':
        title = `${event.name} - GP Points`;
        pointSource = results.grandPrixFinish;
        pointSystemArr = pointsSystem.grandPrixFinish;
        break;
      case 'sprint':
        title = `${event.name} - Sprint Points`;
        pointSource = results.sprintFinish;
        pointSystemArr = pointsSystem.sprintFinish;
        break;
      case 'quali':
        title = `${event.name} - Quali Points`;
        pointSource = results.gpQualifying;
        pointSystemArr = pointsSystem.gpQualifying;
        break;
      case 'sprintQuali':
        title = `${event.name} - Sprint Quali Points`;
        pointSource = results.sprintQualifying;
        pointSystemArr = pointsSystem.sprintQualifying;
        break;
      case 'fl':
        title = `${event.name} - Fastest Lap`;
        break;
    }

    if (category === 'fl') {
      if (picks.fastestLap) {
        const points = picks.fastestLap === results.fastestLap ? pointsSystem.fastestLap : 0;
        if (points !== 0) hasNonZeroPoints = true;
        eventEntries.push(
          <li key={`fl-${picks.fastestLap}`}>{getEntityName(picks.fastestLap)}: <span className="font-semibold">{points} pts</span></li>
        );
      }
    } else if (pointSource && pointSystemArr) {
      const allPickedTeams = [...(picks.aTeams || []), picks.bTeam].filter(Boolean) as string[];
      const allPickedDrivers = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean) as string[];

      allPickedTeams.forEach(teamId => {
        let teamPoints = 0;
        allDrivers.forEach(driver => {
          if (driver.constructorId === teamId) {
            teamPoints += getDriverPoints(driver.id, pointSource, pointSystemArr!);
          }
        });
        if (teamPoints !== 0) hasNonZeroPoints = true;
        eventEntries.push(
          <li key={`team-${teamId}`}>{getEntityName(teamId)}: <span className="font-semibold">{teamPoints} pts</span></li>
        );
      });

      allPickedDrivers.forEach(driverId => {
        const driverPoints = getDriverPoints(driverId, pointSource, pointSystemArr!);
        if (driverPoints !== 0) hasNonZeroPoints = true;
        eventEntries.push(
          <li key={`driver-${driverId}`}>{getEntityName(driverId)}: <span className="font-semibold">{driverPoints} pts</span></li>
        );
      });
    }

    if (eventEntries.length === 0 || !hasNonZeroPoints) {
      eventEntries.push(<li key="no-points" className="text-highlight-silver">No points scored in this category.</li>);
    }

    setModalData({
      title,
      content: <ul className="list-none space-y-1 text-center text-sm text-ghost-white">{eventEntries}</ul>,
    });
  };

  const handleUsageDetailClick = (entityId: string, entityName: string) => {
    const usageEvents = events.filter(event => {
      if (cancelledEventIds.has(event.id)) return false;
      const picks = seasonPicks[event.id];
      if (!picks) return false;
      const allPicked = [...picks.aTeams, picks.bTeam, ...picks.aDrivers, ...picks.bDrivers].filter(Boolean);
      return allPicked.includes(entityId);
    });

    setModalData({
      title: `Usage History: ${entityName}`,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-highlight-silver">
            You have selected <span className="font-bold text-pure-white">{entityName}</span> for the following events:
          </p>
          {usageEvents.length > 0 ? (
            <ul className="space-y-2">
              {usageEvents.map(e => (
                <li key={e.id} className="flex items-center justify-between rounded border border-pure-white/5 bg-carbon-black/50 p-3">
                  <span className="font-semibold text-ghost-white">R{e.round}: {e.name}</span>
                  <span className="text-xs text-highlight-silver">{e.country}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded border border-dashed border-pure-white/15 bg-carbon-black/30 p-4 text-center">
              <p className="text-highlight-silver">No selections made yet.</p>
            </div>
          )}
        </div>
      ),
    });
  };

  /* ---------------------------------------------------------------- layout */

  const aTeams = allConstructors.filter(c => c.class === EntityClass.A);
  const bTeams = allConstructors.filter(c => c.class === EntityClass.B);
  const aDrivers = allDrivers.filter(d => d.class === EntityClass.A);
  const bDrivers = allDrivers.filter(d => d.class === EntityClass.B);

  const isDuesUnpaid = (user.duesPaidStatus || 'Unpaid') !== 'Paid';
  const showEditControls = !isEditingProfile && !!setActivePage && !isPublicView;
  const showDuesIndicator = isDuesUnpaid && !isPublicView;

  const realName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

  const identity = isEditingProfile ? (
    <Tile padding="lg">
      <EditProfileForm user={user} onDone={() => setIsEditingProfile(false)} />
    </Tile>
  ) : isPublicView ? (
    <Tile padding="md" className="mx-auto max-w-md text-center">
      <F1CarIcon className="mx-auto mb-2 h-8 w-8 text-primary-red opacity-80" />
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-highlight-silver">
        Team Name
      </span>
      <span className="block break-words text-3xl font-black leading-tight text-pure-white">
        {user.displayName}
      </span>
    </Tile>
  ) : (
    <Tile padding="md">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-primary-red/30 bg-primary-red/10">
          <ProfileIcon className="h-8 w-8 text-primary-red" />
        </div>
        <div className="min-w-0 text-center sm:text-left">
          <h2 className="truncate text-2xl font-black text-pure-white">{user.displayName}</h2>
          <p className="text-sm text-highlight-silver">
            {realName || '—'}
            <span className="mx-2 opacity-40">·</span>
            <span className="break-all">{user.email}</span>
          </p>
        </div>
        {showDuesIndicator && (
          <button
            onClick={() => setActivePage?.('duesPayment')}
            disabled={!setActivePage}
            className="shrink-0 rounded-full border border-primary-red/50 bg-primary-red/15 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-primary-red transition-colors hover:bg-primary-red hover:text-pure-white disabled:cursor-default sm:ml-auto"
          >
            Dues: Unpaid
          </button>
        )}
      </div>
    </Tile>
  );

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6 text-pure-white">
        {!isPublicView && (
          <PageHeader
            title="PROFILE"
            icon={ProfileIcon}
            rightAction={showEditControls
              ? <AccountMenu user={user} onEditProfile={() => setIsEditingProfile(true)} />
              : undefined}
          />
        )}

        {identity}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-8">
            <div>
              <SectionHeader
                title="Scoring Breakdown"
                subtitle={showsOwnStanding
                  ? 'Your rank and points by category — tap one for the league view'
                  : 'Season totals by category — tap one for the detail'}
                icon={TrophyIcon}
              />
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  label="Total Points"
                  value={scoreRollup.totalPoints}
                  unit="pts"
                  icon={TrophyIcon}
                />
                <StatTile
                  label="Championship Rank"
                  value={globalRank ? `#${globalRank}` : '—'}
                  icon={LeaderboardIcon}
                />
                <button onClick={() => handleCategoryClick('gp')} className="text-left">
                  {(() => {
                    const standing = standingFor('gp');
                    return (
                      <StatTile
                        label="Grand Prix"
                        value={standing ? `#${standing.rank}` : scoreRollup.grandPrixPoints}
                        secondary={standing ? `${scoreRollup.grandPrixPoints} pts` : undefined}
                        accent="gp"
                        accentEdge
                        icon={CheckeredFlagIcon}
                        className="h-full"
                      />
                    );
                  })()}
                </button>
                <button onClick={() => handleCategoryClick('sprint')} className="text-left">
                  {(() => {
                    const standing = standingFor('sprint');
                    return (
                      <StatTile
                        label="Sprint Race"
                        value={standing ? `#${standing.rank}` : scoreRollup.sprintPoints}
                        secondary={standing ? `${scoreRollup.sprintPoints} pts` : undefined}
                        accent="sprint"
                        accentEdge
                        icon={SprintIcon}
                        className="h-full"
                      />
                    );
                  })()}
                </button>
                <button onClick={() => handleCategoryClick('quali')} className="text-left">
                  {(() => {
                    const standing = standingFor('quali');
                    return (
                      <StatTile
                        label="Qualifying"
                        value={standing ? `#${standing.rank}` : qualifyingPoints}
                        secondary={standing ? `${qualifyingPoints} pts` : undefined}
                        accent="quali"
                        accentEdge
                        icon={PolePositionIcon}
                        className="h-full"
                      />
                    );
                  })()}
                </button>
                <button onClick={() => handleCategoryClick('fl')} className="text-left">
                  {(() => {
                    const standing = standingFor('fl');
                    return (
                      <StatTile
                        label="Fastest Lap"
                        value={standing ? `#${standing.rank}` : scoreRollup.fastestLapPoints}
                        secondary={standing ? `${scoreRollup.fastestLapPoints} pts` : undefined}
                        accent="fl"
                        accentEdge
                        icon={FastestLapIcon}
                        className="h-full"
                      />
                    );
                  })()}
                </button>
              </div>
            </div>

            <UsageSection
              lists={[
                {
                  title: 'Class A Teams',
                  entities: aTeams.map(t => ({ id: t.id, name: t.name, color: teamColor(t.id, allConstructors) })),
                  usageData: usageRollup.teams,
                  limit: getLimit(EntityClass.A, 'teams'),
                  onItemClick: handleUsageDetailClick,
                },
                {
                  title: 'Class B Teams',
                  entities: bTeams.map(t => ({ id: t.id, name: t.name, color: teamColor(t.id, allConstructors) })),
                  usageData: usageRollup.teams,
                  limit: getLimit(EntityClass.B, 'teams'),
                  onItemClick: handleUsageDetailClick,
                },
                {
                  title: 'Class A Drivers',
                  entities: aDrivers.map(d => ({ id: d.id, name: d.name, color: teamColor(d.constructorId, allConstructors) })),
                  usageData: usageRollup.drivers,
                  limit: getLimit(EntityClass.A, 'drivers'),
                  onItemClick: handleUsageDetailClick,
                },
                {
                  title: 'Class B Drivers',
                  entities: bDrivers.map(d => ({ id: d.id, name: d.name, color: teamColor(d.constructorId, allConstructors) })),
                  usageData: usageRollup.drivers,
                  limit: getLimit(EntityClass.B, 'drivers'),
                  onItemClick: handleUsageDetailClick,
                },
              ]}
            />
          </div>

          <HistoryList
            events={events}
            seasonPicks={seasonPicks}
            raceResults={raceResults}
            pointsSystem={pointsSystem}
            allDrivers={allDrivers}
            getEntityName={getEntityName}
            onDetailClick={handleEventScoringDetailClick}
            onUpdatePenalty={onUpdatePenalty}
            isPublicView={isPublicView}
          />
        </div>
      </div>

      <Modal
        isOpen={!!modalData}
        onClose={() => setModalData(null)}
        title={modalData?.title}
      >
        {modalData?.content}
      </Modal>
    </>
  );
};

export default ProfilePage;
