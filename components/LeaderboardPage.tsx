
import React, { useMemo, useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SegmentedControl, Drawer, type Segment } from './ui/index.ts';
import PointsTransparency from './PointsTransparency.tsx';
import { P22View } from './standings/P22View.tsx';
import { InsightsView } from './standings/InsightsView.tsx';
import { TrendsView } from './standings/TrendsView.tsx';
import { EntityPointsView } from './standings/EntityPointsView.tsx';
import { calculateScoreRollup, calculatePointsForEvent, processLeaderboardStats } from '../services/scoringService.ts';
import { User, RaceResults, PickSelection, PointsSystem, Event, Driver, Constructor, EventResult, LeaderboardCache } from '../types.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { TrendingUpIcon } from './icons/TrendingUpIcon.tsx';
import { LightbulbIcon } from './icons/LightbulbIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { ListSkeleton, ProfileSkeleton } from './LoadingSkeleton.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import { PageHeader } from './ui/PageHeader.tsx';
import { DEFAULT_PAGE_SIZE, getAllUsersAndPicks, fetchAllUserPicks, getUserPicks } from '../services/firestoreService.ts';
import ProfilePage from './ProfilePage.tsx';
import { parseLeagueDate } from '../utils/dateUtils.ts';
const ExecutiveDashboardView = lazy(() => import('./ExecutiveDashboardView.tsx'));

// --- Configuration ---
const REFRESH_COOLDOWN_SECONDS = 60;
const MAX_DAILY_REFRESHES = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// --- Shared Types & Helpers ---

type ViewState = 'standings' | 'popular' | 'insights' | 'entities' | 'p22' | 'executive';

const VIEWS: Segment<ViewState>[] = [
    { value: 'executive', label: 'Showcase' },
    { value: 'standings', label: 'Standings' },
    { value: 'popular',   label: 'Popular' },
    { value: 'entities',  label: 'Driver & Team Points' },
    { value: 'insights',  label: 'Insights' },
    { value: 'p22',       label: 'P22' },
];

const isViewState = (v: string | null): v is ViewState =>
    !!v && VIEWS.some(s => s.value === v);

type ProcessedUser = User;

interface RefreshPolicy {
    count: number;
    lastRefresh: number;
    dayStart: number;
    lockedUntil: number;
}

interface LeaderboardPageProps {
  currentUser: User | null;
  raceResults: RaceResults;
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
  leaderboardCache: LeaderboardCache | null;
  refreshLeaderboard: () => Promise<void>;
  resetToken?: number; // New prop to trigger menu reset
  cancelledEventIds: Set<string>;
}

const getEntityName = (id: string, allDrivers: Driver[], allConstructors: Constructor[]) => {
    return allDrivers.find(d => d.id === id)?.name || allConstructors.find(c => c.id === id)?.name || id;
};

// --- Sub-Components ---

const RefreshControl: React.FC<{ 
    onClick: () => void; 
    isRefreshing: boolean; 
    cooldown: number;
    status: 'idle' | 'success' | 'error';
    dailyCount: number;
}> = ({ onClick, isRefreshing, cooldown, status, dailyCount }) => {
    
    const formatCooldown = (secs: number) => {
        if (secs < 60) return `${secs}s`;
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m ${s}s`;
    };

    const isLocked = cooldown > 610; // Consider it a "Lock" if wait is > 1 hour
    const remainingDaily = Math.max(0, MAX_DAILY_REFRESHES - dailyCount);

    return (
        <div className="relative flex items-center justify-center">
            {status !== 'idle' && (
                <div className={`
                    absolute right-full mr-3 whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg animate-fade-in
                    ${status === 'success' ? 'bg-green-500 text-carbon-black' : 'bg-red-500 text-pure-white'}
                `}>
                    {status === 'success' ? 'Data Updated ✓' : 'Update Failed ✕'}
                </div>
            )}

            <button 
                onClick={onClick}
                disabled={isRefreshing || cooldown > 0}
                className={`
                    flex items-center justify-center gap-2 p-2 rounded-lg transition-all duration-200 border min-w-[100px]
                    ${(isRefreshing || cooldown > 0)
                        ? 'bg-carbon-black border-accent-gray text-highlight-silver/50 cursor-not-allowed'
                        : 'bg-carbon-black border-accent-gray text-highlight-silver hover:text-pure-white hover:border-primary-red hover:shadow-[0_0_10px_rgba(218,41,28,0.2)]'
                    }
                `}
                title={cooldown > 0 ? (isLocked ? "Daily Limit Reached" : "Cooling Down") : `${remainingDaily} refreshes remaining today`}
            >
                {cooldown > 0 ? (
                    <div className="flex flex-col items-center justify-center leading-none px-2 py-0.5">
                        {isLocked && <span className="text-[8px] font-black uppercase tracking-widest text-red-500 mb-0.5">LOCKED</span>}
                        <span className={`font-mono font-bold text-center ${isLocked ? 'text-xs text-pure-white' : 'text-xs'}`}>
                            {formatCooldown(cooldown)}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isRefreshing ? 'animate-spin text-primary-red' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-sm font-bold uppercase">Refresh</span>
                        <span className="text-[9px] bg-pure-white/10 px-1.5 py-0.5 rounded-full text-highlight-silver ml-1 font-mono">
                            {remainingDaily}
                        </span>
                    </div>
                )}
            </button>
        </div>
    );
};

const RaceChart: React.FC<{ users: ProcessedUser[], currentUser: User | null, hasMore: boolean, onFetchMore: () => void, isPaging: boolean, onSelectUser?: (user: ProcessedUser) => void }> = ({ users, currentUser, hasMore, onFetchMore, isPaging, onSelectUser }) => {
    // Safety check: ensure users is defined
    if (!users || users.length === 0) return null;

    const maxPoints = Math.max(...users.map(u => u.totalPoints || 0), 1);
    
    return (
        <div className="w-full py-2 px-1 md:px-2 md:py-4 lg:py-6 pt-12 md:pt-16">
            <div className="relative">
                {/* Finish Line Icon */}
                <div className="absolute -top-10 right-8 sm:right-10 md:right-14 lg:right-16 transform translate-x-1/2 z-0">
                     <CheckeredFlagIcon className="w-8 h-8 text-pure-white opacity-50" />
                </div>

                <div className="absolute top-0 bottom-0 right-8 sm:right-10 md:right-14 lg:right-16 w-px border-r-2 border-dashed border-pure-white/10 z-0"></div>

                <div className="space-y-1 relative z-10 pb-8 pt-4">
                    {users.map((user, idx) => {
                        const points = user.totalPoints || 0;
                        const rank = user.rank || idx + 1;
                        const percent = (points / maxPoints) * 100;
                        
                        let carColor = "text-primary-red"; 
                        let rankColor = "text-highlight-silver";
                        
                        if (rank === 1) {
                            carColor = "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]";
                            rankColor = "text-yellow-400";
                        } else if (rank === 2) {
                            carColor = "text-gray-300 drop-shadow-[0_0_10px_rgba(209,213,219,0.6)]";
                            rankColor = "text-gray-300";
                        } else if (rank === 3) {
                            carColor = "text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.6)]";
                            rankColor = "text-orange-400";
                        }

                        // Safe display name handling
                        const displayName = user.displayName || "Unknown Team";
                        const shortName = displayName.length > 12 ? `${displayName.substring(0, 12)}...` : displayName;

                        const isCurrentUser = user.id === currentUser?.id || (currentUser?.displayName && user.displayName?.toLowerCase() === currentUser.displayName.toLowerCase());

                        return (
                            <div key={user.id} className={`flex items-center gap-1.5 sm:gap-2 md:gap-3 h-10 md:h-12 lg:h-14 group md:hover:bg-pure-white/5 rounded-lg px-1 md:px-2 transition-colors ${isCurrentUser ? 'bg-pure-white/[0.07] border border-pure-white/25 shadow-md ring-1 ring-pure-white/20' : ''}`}>
                                <div className={`w-5 sm:w-6 md:w-8 text-center font-black text-xs sm:text-sm md:text-lg lg:text-xl ${rankColor} shrink-0`}>
                                    {rank}
                                </div>
                                <div className="w-[4.5rem] sm:w-24 md:w-60 lg:w-72 text-left font-semibold md:font-bold text-[10px] md:text-sm lg:text-base text-highlight-silver md:group-hover:text-pure-white transition-colors shrink-0 flex items-center gap-1.5">
                                    <span className="md:hidden truncate">
                                        {shortName}
                                    </span>
                                    <span className="hidden md:inline truncate">
                                        {displayName}
                                    </span>
                                    {isCurrentUser && (
                                        <span className="text-[8px] font-mono font-bold bg-pure-white/15 text-pure-white px-1.5 py-0.2 rounded border border-pure-white/30 shrink-0">
                                            YOU
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 relative h-full flex items-center ml-2 sm:ml-4 md:ml-6 mr-1 md:mr-2">
                                    <div className="absolute left-0 right-0 h-px bg-pure-white/10 w-full rounded-full"></div>
                                    <div 
                                        className="relative h-full flex items-center justify-end transition-all duration-1000 ease-out pr-5 sm:pr-6 md:pr-14 lg:pr-16 cursor-pointer"
                                        style={{ width: `${percent}%` }}
                                        onClick={() => onSelectUser?.(user)}
                                    >
                                        <div className="relative group/car">
                                            <F1CarIcon className={`w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 transform -rotate-90 ${carColor} transition-transform group-hover/car:scale-125`} />
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/car:opacity-10 whitespace-nowrap pointer-events-none transition-opacity font-bold uppercase tracking-wider shadow-lg border border-pure-white/10 z-20">
                                                Inspect
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-8 md:w-12 text-right font-mono font-bold text-xs md:text-sm text-pure-white shrink-0">
                                    {points}
                                </div>
                            </div>
                        );
                    })}

                    {/* Pagination [S1C-01] */}
                    {hasMore && (
                        <div className="flex justify-center pt-8">
                            <button 
                                // Fix: use onFetchMore from props instead of handleFetchMore
                                onClick={onFetchMore}
                                disabled={isPaging}
                                className="bg-carbon-black hover:bg-accent-gray text-pure-white font-bold py-2.5 px-8 rounded-lg border border-pure-white/10 shadow-lg flex items-center gap-3 transition-all transform active:scale-95"
                            >
                                {isPaging ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <CheckeredFlagIcon className="w-5 h-5 text-primary-red" />
                                )}
                                Load More Grid
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Views ---

const StandingsView: React.FC<{ 
    users: ProcessedUser[]; 
    currentUser: User | null;
    hasMore: boolean;
    onFetchMore: () => void;
    isPaging: boolean;
    onSelectUser: (user: ProcessedUser) => void;
}> = ({ users, currentUser, hasMore, onFetchMore, isPaging, onSelectUser }) => {
    
    return (
        <div className="flex flex-col md:h-full animate-fade-in pb-safe overflow-hidden">
            <div className="flex flex-col md:h-full bg-carbon-fiber border border-pure-white/10 rounded-xl overflow-hidden shadow-2xl">
                <div className="md:flex-1 md:overflow-y-auto custom-scrollbar p-4 md:min-h-0 pb-24 md:pb-4">
                    <RaceChart users={users} currentUser={currentUser} hasMore={hasMore} onFetchMore={onFetchMore} isPaging={isPaging} onSelectUser={onSelectUser} />
                </div>
            </div>
        </div>
    );
};

const ViewLoadingFallback: React.FC = () => (
  <div className="w-full min-h-[40vh] flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-2 border-accent-gray border-t-primary-red animate-spin" />
  </div>
);

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ 
    currentUser, 
    raceResults, 
    pointsSystem, 
    allDrivers, 
    allConstructors, 
    events, 
    leaderboardCache, 
    refreshLeaderboard,
    resetToken,
    cancelledEventIds
}) => {
  // The view and the rules drawer both live in the URL, so a specific view is linkable.
  const [searchParams, setSearchParams] = useSearchParams();
  const view: ViewState = isViewState(searchParams.get('view')) ? searchParams.get('view') as ViewState : 'standings';
  const rulesOpen = searchParams.get('rules') === '1';

  const setParam = (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (value === null) next.delete(key); else next.set(key, value);
      setSearchParams(next, { replace: true });
  };
  const setView = (v: ViewState) => setParam('view', v);
  const [processedUsers, setProcessedUsers] = useState<ProcessedUser[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaging, setIsPaging] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // New: Global league picks for popularity calculation
  const [allLeaguePicks, setAllLeaguePicks] = useState<{ [uid: string]: { [eid: string]: PickSelection } }>({});
  const [isFetchingGlobalPicks, setIsFetchingGlobalPicks] = useState(false);

  // New: Modal User State
  const [selectedUserProfile, setSelectedUserProfile] = useState<ProcessedUser | null>(null);
  const [modalPicks, setModalPicks] = useState<any>(null);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  
  const pageRef = useRef<HTMLDivElement>(null);

  // Initialize from storage or default
  const [refreshPolicy, setRefreshPolicy] = useState<RefreshPolicy>(() => {
        const saved = localStorage.getItem('lb_refresh_policy');
        return saved ? JSON.parse(saved) : { count: 0, lastRefresh: 0, dayStart: Date.now(), lockedUntil: 0 };
  });

    // Fix: When the view changes, find the main scrolling container and scroll it to the top.
    useEffect(() => {
        if (pageRef.current) {
            let scrollParent = pageRef.current.parentElement;
            while (scrollParent) {
                const { overflowY } = window.getComputedStyle(scrollParent);
                if (overflowY === 'auto' || overflowY === 'scroll') {
                    scrollParent.scrollTop = 0;
                    return;
                }
                scrollParent = scrollParent.parentElement;
            }
            // Fallback for body/window scrolling
            window.scrollTo(0, 0);
        }
    }, [view]);

  // Calculate initial cooldown/lockout time
  const calculateRemainingTime = useCallback(() => {
        const now = Date.now();
        if (refreshPolicy.lockedUntil > now) {
            return Math.ceil((refreshPolicy.lockedUntil - now) / 1000);
        }
        const elapsed = (now - refreshPolicy.lastRefresh) / 1000;
        if (elapsed < REFRESH_COOLDOWN_SECONDS) {
            return Math.ceil(REFRESH_COOLDOWN_SECONDS - elapsed);
        }
        return 0;
  }, [refreshPolicy]);

  const [cooldownTime, setCooldownTime] = useState(calculateRemainingTime());

  // Check for daily reset on mount/focus to ensure UI is up to date
  useEffect(() => {
      const checkPolicyIntegrity = () => {
          const now = Date.now();
          const stored = localStorage.getItem('lb_refresh_policy');
          if (stored) {
              const p = JSON.parse(stored);
              
              // Condition 1: Day has passed (24h window)
              if (now - p.dayStart > 24 * 60 * 60 * 1000) {
                  const newP = { count: 0, lastRefresh: 0, dayStart: now, lockedUntil: 0 };
                  localStorage.setItem('lb_refresh_policy', JSON.stringify(newP));
                  setRefreshPolicy(newP);
                  setCooldownTime(0);
                  return;
              }

              // Condition 2: Lockout has expired but day hasn't reset (Edge case correction)
              if (p.lockedUntil > 0 && now > p.lockedUntil) {
                   const newP = { ...p, lockedUntil: 0 };
                   localStorage.setItem('lb_refresh_policy', JSON.stringify(newP));
                   setRefreshPolicy(newP);
                   setCooldownTime(0);
              }
          }
      };

      checkPolicyIntegrity();
      window.addEventListener('focus', checkPolicyIntegrity);
      return () => window.removeEventListener('focus', checkPolicyIntegrity);
  }, []);

  // Fetch Picks on Modal Open if needed
  useEffect(() => {
    if (selectedUserProfile) {
        // Check cache first
        const cached = leaderboardCache?.allPicks?.[selectedUserProfile.id];
        // Ensure cached is not just an empty object if user actually has picks (but cache might be partial)
        // For simplicity, if cache exists and source is 'private_fallback', we trust it. 
        // If source is 'public', allPicks is usually empty, so we must fetch.
        
        // However, fetching a single user doc is cheap.
        if (cached && Object.keys(cached).length > 0) {
            setModalPicks(cached);
        } else {
            setIsLoadingPicks(true);
            getUserPicks(selectedUserProfile.id).then(picks => {
                setModalPicks(picks);
                setIsLoadingPicks(false);
            }).catch(err => {
                console.error("Failed to fetch user picks", err);
                setIsLoadingPicks(false);
            });
        }
    } else {
        setModalPicks(null);
    }
  }, [selectedUserProfile, leaderboardCache]);

  // [S1A-03] Extract scoring transformations out of React Effects
  const loadProcessedData = useCallback(async (usersBatch: User[], picksBatch: any, isMore = false) => {
      // Logic extracted to service module processLeaderboardStats
      const processedBatch = await processLeaderboardStats(usersBatch, picksBatch, raceResults, pointsSystem, allDrivers, currentUser, cancelledEventIds);
      if (isMore) {
          setProcessedUsers(prev => [...prev, ...processedBatch]);
      } else {
          setProcessedUsers(processedBatch);
      }
  }, [raceResults, pointsSystem, allDrivers, currentUser]);

  // Timer Effect
  useEffect(() => {
      if (cooldownTime <= 0) return;
      const timer = setInterval(() => {
          setCooldownTime(prev => {
              if (prev <= 1) {
                  // Timer finished. 
                  const stored = localStorage.getItem('lb_refresh_policy');
                  if (stored) {
                      const p = JSON.parse(stored);
                      if (p.lockedUntil > 0 && Date.now() > p.lockedUntil) {
                          const resetP = { ...p, lockedUntil: 0, count: 0, dayStart: Date.now() };
                          localStorage.setItem('lb_refresh_policy', JSON.stringify(resetP));
                          setRefreshPolicy(resetP);
                      }
                  }
                  return 0;
              }
              return prev - 1;
          });
      }, 1000);
      return () => clearInterval(timer);
  }, [cooldownTime]);

  // Tapping Standings while already on it returns to the default view.
  useEffect(() => {
    if (resetToken) {
      setView('standings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  // Initial Data Load
  useEffect(() => {
      if (!leaderboardCache) {
          refreshLeaderboard();
      } else {
          loadProcessedData(leaderboardCache.users, leaderboardCache.allPicks);
          setHasMore(leaderboardCache.users.length === DEFAULT_PAGE_SIZE);
      }
  }, [leaderboardCache]); // Only re-run when cache itself changes

  // Global Picks Fetch Effect for Popularity View
  useEffect(() => {
    if (view === 'popular' && Object.keys(allLeaguePicks).length === 0 && !isFetchingGlobalPicks) {
        setIsFetchingGlobalPicks(true);
        fetchAllUserPicks()
            .then(picks => {
                setAllLeaguePicks(picks);
                setIsFetchingGlobalPicks(false);
            })
            .catch(err => {
                console.error("Failed to fetch global league picks:", err);
                setIsFetchingGlobalPicks(false);
            });
    }
  }, [view, allLeaguePicks, isFetchingGlobalPicks]);

  // [S1A-03] Handle external system updates (scoring rules/results changes)
  // We process with a slight delay to ensure UI stays responsive during rapid changes
  useEffect(() => {
    if (leaderboardCache) {
        const timeout = setTimeout(() => {
            loadProcessedData(leaderboardCache.users, leaderboardCache.allPicks);
        }, 300);
        return () => clearTimeout(timeout);
    }
  }, [raceResults, pointsSystem, allDrivers, currentUser, loadProcessedData]);

  const handleFetchMore = async () => {
    if (isPaging || !hasMore) return;
    setIsPaging(true);
    try {
        const { users, allPicks, lastDoc } = await getAllUsersAndPicks(DEFAULT_PAGE_SIZE, lastVisible || (leaderboardCache as any)?.lastDoc);
        await loadProcessedData(users, allPicks, true);
        setLastVisible(lastDoc);
        setHasMore(users.length === DEFAULT_PAGE_SIZE);
    } catch (e) {
        console.error(e);
    } finally {
        setIsPaging(false);
    }
  };

  const handleManualRefresh = async () => {
      // 1. Check Cooldown & Lock Status
      if (cooldownTime > 0 || isRefreshing) return;

      const now = Date.now();
      
      // 2. Check Daily Reset Logic
      let currentPolicy = { ...refreshPolicy };
      // If last reset was more than 24h ago, reset count
      if (now - currentPolicy.dayStart > 24 * 60 * 60 * 1000) {
          currentPolicy = { count: 0, lastRefresh: 0, dayStart: now, lockedUntil: 0 };
      }

      // 3. Check Daily Limit
      if (currentPolicy.count >= MAX_DAILY_REFRESHES) {
          // Lock User Out
          const lockedUntil = now + LOCKOUT_DURATION_MS;
          const newPolicy = { ...currentPolicy, lockedUntil };
          setRefreshPolicy(newPolicy);
          localStorage.setItem('lb_refresh_policy', JSON.stringify(newPolicy));
          setCooldownTime(Math.ceil(LOCKOUT_DURATION_MS / 1000));
          return;
      }

      setIsRefreshing(true);
      setRefreshStatus('idle');
      try {
          await refreshLeaderboard();
          // If on popular view, also refresh global picks
          if (view === 'popular') {
              setIsFetchingGlobalPicks(true);
              const picks = await fetchAllUserPicks();
              setAllLeaguePicks(picks);
              setIsFetchingGlobalPicks(false);
          }
          setRefreshStatus('success');
          
          // 4. Update Policy on Success
          const newCount = currentPolicy.count + 1;
          let newLockedUntil = 0;
          let newCooldown = REFRESH_COOLDOWN_SECONDS;

          // If this hit the limit, lock them out immediately for next time
          if (newCount >= MAX_DAILY_REFRESHES) {
              newLockedUntil = now + LOCKOUT_DURATION_MS;
              newCooldown = Math.ceil(LOCKOUT_DURATION_MS / 1000);
          }

          const newPolicy = {
              ...currentPolicy,
              count: newCount,
              lastRefresh: now,
              lockedUntil: newLockedUntil
          };
          
          setRefreshPolicy(newPolicy);
          localStorage.setItem('lb_refresh_policy', JSON.stringify(newPolicy));
          setCooldownTime(newCooldown);

          setLastVisible(null);
          setTimeout(() => setRefreshStatus('idle'), 3000);
      } catch (e) {
          console.error(e);
          setRefreshStatus('error');
          setTimeout(() => setRefreshStatus('idle'), 3000);
      } finally {
          setIsRefreshing(false);
      }
  };

  const isLoading = !leaderboardCache && processedUsers.length === 0;

  if (isLoading) return <ListSkeleton rows={10} />;

  // Scoring rules belong beside the numbers they explain, not on a page of their own.
  const rulesAction = (
      <button
          onClick={() => setParam('rules', '1')}
          className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
      >
          <TrophyIcon className="w-4 h-4" />
          <span className="text-sm font-bold">Scoring rules</span>
      </button>
  );

  const getHeaderProps = () => {
      switch (view) {
          case 'executive': return { title: "EXECUTIVE DASHBOARD", icon: TrophyIcon };
          case 'standings': return { title: "LEAGUE STANDINGS", icon: LeaderboardIcon };
          case 'popular': return { title: "POPULAR PICKS", icon: TrendingUpIcon };
          case 'entities': return { title: "DRIVER & TEAM POINTS", icon: TeamIcon };
          case 'insights': return { title: "PERFORMANCE INSIGHTS", icon: LightbulbIcon };
          case 'p22': return { title: "P22 TRACKER", icon: TrashIcon };
          default: return { title: "LEADERBOARDS", icon: LeaderboardIcon };
      }
  };

  const headerProps = getHeaderProps();

  // Merge current user data if self-inspecting to show PII
  const userToDisplay = (currentUser && selectedUserProfile && currentUser.id === selectedUserProfile.id) 
    ? { ...selectedUserProfile, ...currentUser } 
    : selectedUserProfile;

  return (
      <div ref={pageRef} className="flex flex-col md:h-full md:overflow-hidden w-full max-w-7xl mx-auto">
          <div className="flex-none">
              <PageHeader 
                  title={headerProps.title} 
                  icon={headerProps.icon} 
                  leftAction={rulesAction}
                  rightAction={<RefreshControl onClick={handleManualRefresh} isRefreshing={isRefreshing} cooldown={cooldownTime} status={refreshStatus} dailyCount={refreshPolicy.count}/>}
              />
          </div>

          <div className="flex-none px-2 md:px-0 pb-3">
              <SegmentedControl segments={VIEWS} value={view} onChange={v => setView(v)} scrollable size="sm" />
          </div>

          <div className="md:flex-1 md:overflow-hidden px-2 md:px-0 pb-4">
            {view === 'executive' && <Suspense fallback={<ViewLoadingFallback />}><ExecutiveDashboardView users={processedUsers} currentUser={currentUser} allDrivers={allDrivers} allConstructors={allConstructors} events={events} onSelectUser={setSelectedUserProfile} /></Suspense>}
            {view === 'standings' && <StandingsView users={processedUsers} currentUser={currentUser} hasMore={hasMore} onFetchMore={handleFetchMore} isPaging={isPaging} onSelectUser={setSelectedUserProfile} />}
            {view === 'popular' && <TrendsView allLeaguePicks={allLeaguePicks} allDrivers={allDrivers} allConstructors={allConstructors} events={events} isLoading={isFetchingGlobalPicks} cancelledEventIds={cancelledEventIds} currentUser={currentUser} />}
            {view === 'insights' && <InsightsView users={processedUsers} currentUser={currentUser} />}
            {view === 'entities' && <EntityPointsView raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} events={events} />}
            {view === 'p22' && <P22View users={processedUsers} currentUser={currentUser} />}
          </div>

          <Drawer
            isOpen={rulesOpen}
            onClose={() => setParam('rules', null)}
            title="Scoring Rules"
            subtitle="How every point on this page is earned"
          >
            <PointsTransparency
              embedded
              pointsSystem={pointsSystem}
              allDrivers={allDrivers}
              allConstructors={allConstructors}
              setActivePage={() => setParam('rules', null)}
            />
          </Drawer>

          {/* User Profile Modal */}
          {selectedUserProfile && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedUserProfile(null)}>
                <div className="bg-carbon-black border border-pure-white/10 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
                    {/* Header - Centered with Red Icon */}
                    <div className="relative flex items-center justify-center p-4 border-b border-pure-white/10 bg-carbon-fiber">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary-red/20 p-2 rounded-full border border-primary-red/50 shadow-[0_0_10px_rgba(218,41,28,0.3)]">
                                <F1CarIcon className="w-5 h-5 text-primary-red" />
                            </div>
                            <h2 className="text-xl md:text-2xl font-black text-pure-white uppercase italic tracking-wider">
                                Team Inspection
                            </h2>
                        </div>
                        <button 
                            onClick={() => setSelectedUserProfile(null)} 
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-pure-white/10 rounded-full text-highlight-silver hover:text-pure-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-carbon-black/50">
                        {isLoadingPicks ? (
                            <ProfileSkeleton />
                        ) : (
                            <ProfilePage 
                                user={userToDisplay!}
                                seasonPicks={modalPicks || {}}
                                raceResults={raceResults}
                                pointsSystem={pointsSystem}
                                allDrivers={allDrivers}
                                allConstructors={allConstructors}
                                events={events}
                                isPublicView={true}
                                cancelledEventIds={cancelledEventIds}
                            />
                        )}
                    </div>
                </div>
            </div>
          )}
      </div>
  );
};

export default LeaderboardPage;
