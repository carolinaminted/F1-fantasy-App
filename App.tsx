
// Fix: Implement the main App component to provide structure, state management, and navigation.
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import AuthScreen from './components/AuthScreen.tsx';
import HomePage from './components/HomePage.tsx';
import ProfilePage from './components/ProfilePage.tsx';
import LeaderboardPage from './components/LeaderboardPage.tsx';
import Dashboard from './components/Dashboard.tsx';
import AdminPage from './components/AdminPage.tsx';
import ResultsManagerPage from './components/ResultsManagerPage.tsx';
import ManageUsersPage from './components/ManageUsersPage.tsx';
import ManageEntitiesPage from './components/ManageEntitiesPage.tsx';
import ManageSchedulePage from './components/ManageSchedulePage.tsx';
import AdminSimulationPage from './components/AdminSimulationPage.tsx';
import ScoringSettingsPage from './components/ScoringSettingsPage.tsx';
import AdminInvitationPage from './components/AdminInvitationPage.tsx';
import PointsTransparency from './components/PointsTransparency.tsx';
import DonationPage from './components/DonationPage.tsx';
import DuesPaymentPage from './components/DuesPaymentPage.tsx';
import GpResultsPage from './components/GpResultsPage.tsx';
import DriversTeamsPage from './components/DriversTeamsPage.tsx';
import SchedulePage from './components/SchedulePage.tsx';
import EventsHubPage from './components/EventsHubPage.tsx';
import LeagueHubPage from './components/LeagueHubPage.tsx';
import SessionWarningModal from './components/SessionWarningModal.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { User, PickSelection, RaceResults, PointsSystem, Driver, Constructor, ScoringSettingsDoc, EventSchedule, LeaderboardCache } from './types.ts';
import { HomeIcon } from './components/icons/HomeIcon.tsx';
import { DonationIcon } from './components/icons/DonationIcon.tsx';
import { PicksIcon } from './components/icons/PicksIcon.tsx';
import { ProfileIcon } from './components/icons/ProfileIcon.tsx';
import { LeaderboardIcon } from './components/icons/LeaderboardIcon.tsx';
import { F1CarIcon } from './components/icons/F1CarIcon.tsx';
import { AdminIcon } from './components/icons/AdminIcon.tsx';
import { TrophyIcon } from './components/icons/TrophyIcon.tsx';
import { TrackIcon } from './components/icons/TrackIcon.tsx';
import { GarageIcon } from './components/icons/GarageIcon.tsx';
import { CalendarIcon } from './components/icons/CalendarIcon.tsx';
import { LeagueIcon } from './components/icons/LeagueIcon.tsx';
import { ChevronDownIcon } from './components/icons/ChevronDownIcon.tsx';
import { RACE_RESULTS, DEFAULT_POINTS_SYSTEM, DRIVERS, CONSTRUCTORS, EVENTS } from './constants.ts';
import { auth, db } from './services/firebase.ts';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { onAuthStateChanged } from '@firebase/auth';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { onSnapshot, doc } from '@firebase/firestore';
import { getUserProfile, getUserPicks, saveUserPicks, saveFormLocks, saveRaceResults, saveScoringSettings, getLeagueEntities, saveLeagueEntities, getEventSchedules, getAllUsersAndPicks } from './services/firestoreService.ts';
import { calculateScoreRollup } from './services/scoringService.ts';
import { useSessionGuard } from './hooks/useSessionGuard.ts';
import { AppSkeleton } from './components/LoadingSkeleton.tsx';
import { useToast } from './contexts/ToastContext.tsx';


export type Page = 'home' | 'picks' | 'leaderboard' | 'profile' | 'admin' | 'points' | 'donate' | 'gp-results' | 'duesPayment' | 'drivers-teams' | 'schedule' | 'events-hub' | 'league-hub';


// New SideNavItem component for desktop sidebar
interface SideNavItemProps {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  page: Page;
  activePage: Page;
  setActivePage: (page: Page) => void;
  isParentActive?: boolean;
}

const SideNavItem: React.FC<SideNavItemProps> = ({ icon: Icon, label, page, activePage, setActivePage, isParentActive }) => {
  const isActive = isParentActive !== undefined ? isParentActive : activePage === page;
  return (
    <button
      onClick={() => setActivePage(page)}
      className={`flex items-center gap-4 px-3 py-3 rounded-lg transition-colors duration-200 w-full text-left ${
        isActive
          ? 'bg-accent-gray text-pure-white font-semibold'
          : 'text-highlight-silver hover:bg-accent-gray/50 hover:text-pure-white'
      }`}
    >
      <Icon className={`w-8 h-8 flex-shrink-0 ${isActive ? 'text-primary-red' : ''}`} />
      <span className="text-base font-medium">{label}</span>
    </button>
  );
};

const isUserAdmin = (user: User | null) => {
    return !!user?.isAdmin;
};

const getUserRealName = (user: User | null) => {
    if (!user) return '';
    if (user.firstName || user.lastName) {
        return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.displayName;
};

// New SideNav component for desktop view
const SideNav: React.FC<{ user: User | null; activePage: Page; navigateToPage: (page: Page) => void; handleLogout: () => void; livePoints: number }> = ({ user, activePage, navigateToPage, handleLogout, livePoints }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <aside className="hidden md:flex flex-col w-72 bg-carbon-black border-r border-accent-gray p-4 flex-shrink-0 h-screen overflow-y-auto custom-scrollbar">
            {/* Header / User Dropdown */}
            <div className="relative mb-4" ref={dropdownRef}>
                <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`flex items-center gap-3 w-full p-2 rounded-xl transition-all duration-200 border ${
                        isDropdownOpen 
                        ? 'bg-accent-gray/40 border-pure-white/10' 
                        : 'hover:bg-accent-gray/20 border-transparent'
                    }`}
                >
                   <F1CarIcon className="w-10 h-10 text-primary-red flex-shrink-0" />
                   <div className="flex flex-col overflow-hidden text-left flex-1">
                       <span className="font-bold text-lg truncate leading-tight text-pure-white group-hover:text-primary-red transition-colors">{getUserRealName(user)}</span>
                       {user && (
                           <span className="text-[13px] text-highlight-silver font-mono mt-0.5">
                               #{user.rank || '-'} • {livePoints} pts
                           </span>
                       )}
                   </div>
                   <ChevronDownIcon className={`w-4 h-4 text-highlight-silver transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-carbon-black border border-pure-white/10 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] z-50 overflow-hidden animate-fade-in-down origin-top">
                        <div className="p-1">
                            <button 
                                onClick={() => { navigateToPage('profile'); setIsDropdownOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm font-semibold text-pure-white hover:bg-pure-white/10 rounded-lg flex items-center gap-3 transition-colors"
                            >
                                <ProfileIcon className="w-4 h-4 text-highlight-silver" />
                                Profile
                            </button>
                            <button 
                                onClick={() => { navigateToPage('league-hub'); setIsDropdownOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm font-semibold text-pure-white hover:bg-pure-white/10 rounded-lg flex items-center gap-3 transition-colors"
                            >
                                <LeagueIcon className="w-4 h-4 text-highlight-silver" />
                                League Hub
                            </button>
                            
                            <div className="h-px bg-pure-white/10 my-1 mx-2"></div>
                            
                            <button 
                                onClick={() => { handleLogout(); setIsDropdownOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm font-bold text-primary-red hover:bg-primary-red/10 rounded-lg flex items-center gap-3 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                                Log Out
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <nav className="flex-grow space-y-1">
                <SideNavItem icon={HomeIcon} label="Home" page="home" activePage={activePage} setActivePage={navigateToPage} />
                <SideNavItem icon={ProfileIcon} label="Profile" page="profile" activePage={activePage} setActivePage={navigateToPage} />
                <SideNavItem icon={PicksIcon} label="GP Picks" page="picks" activePage={activePage} setActivePage={navigateToPage} />
                <SideNavItem icon={LeaderboardIcon} label="Leaderboard" page="leaderboard" activePage={activePage} setActivePage={navigateToPage} />
                
                {/* Consolidated League Item - Now includes events and league pages */}
                <SideNavItem 
                    icon={LeagueIcon} 
                    label="League" 
                    page="league-hub" 
                    activePage={activePage} 
                    setActivePage={navigateToPage} 
                    isParentActive={['league-hub', 'points', 'donate', 'duesPayment', 'schedule', 'gp-results', 'drivers-teams'].includes(activePage)}
                />

                {isUserAdmin(user) && (
                  <SideNavItem icon={AdminIcon} label="Admin" page="admin" activePage={activePage} setActivePage={navigateToPage} />
                )}
            </nav>
             
             <div className="mt-auto flex-shrink-0 pt-4 pb-2">
                 {/* Copyright Section - Moved Here for Desktop Persistence */}
                 <div className="text-center opacity-30 pb-4">
                    <F1CarIcon className="w-8 h-8 mx-auto mb-2 text-pure-white" />
                    <p className="text-[10px] text-highlight-silver uppercase tracking-widest">Formula Fantasy One © {new Date().getFullYear()}</p>
                 </div>
             </div>
        </aside>
    );
};


const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePage, setActivePage] = useState<Page>('home');
  const [targetEventId, setTargetEventId] = useState<string | null>(null);
  const [adminSubPage, setAdminSubPage] = useState<'dashboard' | 'results' | 'manage-users' | 'scoring' | 'entities' | 'simulation' | 'schedule' | 'invitations'>('dashboard');
  const [seasonPicks, setSeasonPicks] = useState<{ [eventId: string]: PickSelection }>({});
  const [raceResults, setRaceResults] = useState<RaceResults>({});
  const [formLocks, setFormLocks] = useState<{ [eventId: string]: boolean }>({});
  const [eventSchedules, setEventSchedules] = useState<{ [eventId: string]: EventSchedule }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const { showToast } = useToast();

  // Pages that should have a fixed (non-scrolling) viewport on desktop, allowing internal scrolling.
  // Currently enabled for Donation and DuesPayment as requested.
  const lockedDesktopPages: Page[] = ['donate', 'duesPayment'];
  const isLockedLayout = lockedDesktopPages.includes(activePage);

  // Data Cache for Leaderboard to prevent redundant fetches on tab switch
  const [leaderboardCache, setLeaderboardCache] = useState<LeaderboardCache | null>(null);

  // Implement Session Security
  const { showWarning, idleExpiryTime, continueSession, logout: sessionLogout } = useSessionGuard(user);
  
  // Scoring State
  const defaultSettings: ScoringSettingsDoc = {
      activeProfileId: 'default',
      profiles: [{ id: 'default', name: 'Default System', config: DEFAULT_POINTS_SYSTEM }]
  };
  const [scoringSettings, setScoringSettings] = useState<ScoringSettingsDoc>(defaultSettings);
  
  // Derived state for the currently active points system
  const activePointsSystem = useMemo(() => {
      const profile = scoringSettings.profiles.find(p => p.id === scoringSettings.activeProfileId);
      return profile ? profile.config : DEFAULT_POINTS_SYSTEM;
  }, [scoringSettings]);

  // Dynamic Entities State
  const [allDrivers, setAllDrivers] = useState<Driver[]>(DRIVERS);
  const [allConstructors, setAllConstructors] = useState<Constructor[]>(CONSTRUCTORS);

  // Dynamic Events State - Merge static constants with DB overrides
  const mergedEvents = useMemo(() => {
      return EVENTS.map(e => {
          const sched = eventSchedules[e.id];
          return {
              ...e,
              name: sched?.name || e.name,
              hasSprint: sched?.hasSprint !== undefined ? sched.hasSprint : e.hasSprint
          };
      });
  }, [eventSchedules]);

  // Calculate live points for the current user to ensure SideNav is always up to date
  const currentTotalPoints = useMemo(() => {
      if (!user) return 0;
      return calculateScoreRollup(seasonPicks, raceResults, activePointsSystem, allDrivers).totalPoints;
  }, [seasonPicks, raceResults, activePointsSystem, allDrivers, user]);

  // Centralized Data Fetch for Leaderboard
  const fetchLeaderboardData = useCallback(async () => {
      try {
          const { users, allPicks, source } = await getAllUsersAndPicks();
          setLeaderboardCache({
              users,
              allPicks,
              source,
              lastUpdated: Date.now()
          });
      } catch (e) {
          console.error("Failed to fetch leaderboard data", e);
      }
  }, []);

  // Fallback to fetch global rank if missing (e.g. cloud function hasn't run yet)
  useEffect(() => {
      const fetchRankFallback = async () => {
          if (user && !user.rank && user.id && currentTotalPoints > 0) {
              try {
                  // Use cache if available to avoid extra reads
                  let usersList = leaderboardCache?.users;
                  let allPicks = leaderboardCache?.allPicks;

                  if (!usersList || !allPicks) {
                      const data = await getAllUsersAndPicks();
                      usersList = data.users;
                      allPicks = data.allPicks;
                      // Update cache while we are at it
                      setLeaderboardCache({ ...data, lastUpdated: Date.now() });
                  }

                  const validUsers = usersList.filter(u => u.displayName !== 'Admin Principal');
                  
                  const scores = validUsers.map(u => {
                      // If public profile has points, use them. Otherwise calc.
                      if (u.totalPoints !== undefined) return { uid: u.id, points: u.totalPoints };
                      
                      const picks = allPicks[u.id] || {};
                      const score = calculateScoreRollup(picks, raceResults, activePointsSystem, allDrivers);
                      return { uid: u.id, points: score.totalPoints };
                  });
                  
                  scores.sort((a, b) => b.points - a.points);
                  const index = scores.findIndex(s => s.uid === user.id);
                  if (index !== -1) {
                      setUser(prev => prev ? { ...prev, rank: index + 1 } : prev);
                  }
              } catch (e) {
                  // Silent fail on rank fallback
              }
          }
      };
      
      if (user && !user.rank) {
          fetchRankFallback();
      }
  }, [user?.id, user?.rank, raceResults, activePointsSystem, allDrivers, currentTotalPoints, leaderboardCache]);

  useEffect(() => {
    let unsubscribeResults = () => {};
    let unsubscribeLocks = () => {};
    let unsubscribeProfile = () => {};
    let unsubscribePoints = () => {};
    let unsubscribeSchedules = () => {};
    let unsubscribePublicProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous listeners before setting new ones or logging out
      unsubscribeResults();
      unsubscribeLocks();
      unsubscribeProfile();
      unsubscribePoints();
      unsubscribeSchedules();
      unsubscribePublicProfile();

      setIsLoading(true);
      if (firebaseUser) {
        // Load Dynamic Entities (Drivers/Teams)
        const entities = await getLeagueEntities();
        if (entities) {
            setAllDrivers(entities.drivers);
            setAllConstructors(entities.constructors);
        } else {
            // Seed DB if empty
            await saveLeagueEntities(DRIVERS, CONSTRUCTORS);
        }

        // Load Event Schedules
        const schedulesRef = doc(db, 'app_state', 'event_schedules');
        unsubscribeSchedules = onSnapshot(schedulesRef, (docSnap) => {
            if (docSnap.exists()) {
                setEventSchedules(docSnap.data() as { [eventId: string]: EventSchedule });
            }
        }, (error) => console.error("Firestore listener error (event_schedules):", error));

        // Listen to global app state
        const resultsRef = doc(db, 'app_state', 'race_results');
        unsubscribeResults = onSnapshot(resultsRef, (docSnap) => {
          if (docSnap.exists() && Object.keys(docSnap.data()).length > 0) {
            setRaceResults(docSnap.data() as RaceResults);
          } else {
            console.log("No race results found. Seeding with initial data.");
            saveRaceResults(RACE_RESULTS);
          }
        }, (error) => console.error("Firestore listener error (race_results):", error));

        const locksRef = doc(db, 'app_state', 'form_locks');
        unsubscribeLocks = onSnapshot(locksRef, (docSnap) => {
            if (docSnap.exists()) {
                setFormLocks(docSnap.data());
            } else {
                console.log("Form locks not found. Creating a new one.");
                saveFormLocks({});
            }
        }, (error) => console.error("Firestore listener error (form_locks):", error));

        const pointsRef = doc(db, 'app_state', 'scoring_config');
        unsubscribePoints = onSnapshot(pointsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.profiles && Array.isArray(data.profiles)) {
                    setScoringSettings(data as ScoringSettingsDoc);
                } else {
                    console.log("Migrating legacy scoring config to profiles...");
                    const migratedSettings: ScoringSettingsDoc = {
                        activeProfileId: 'legacy',
                        profiles: [{ id: 'legacy', name: 'Legacy Config', config: data as PointsSystem }]
                    };
                    setScoringSettings(migratedSettings);
                }
            } else {
                console.log("Points system config not found. Seeding default.");
                saveScoringSettings(defaultSettings);
            }
        }, (error) => console.error("Firestore listener error (scoring_config):", error));

        // Listener for Public Profile (Rank & Points)
        const publicProfileRef = doc(db, 'public_users', firebaseUser.uid);
        unsubscribePublicProfile = onSnapshot(publicProfileRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setUser(prev => {
                    // Only update if we have a user state and IDs match
                    if (prev && prev.id === firebaseUser.uid) {
                        return { ...prev, rank: data.rank, totalPoints: data.totalPoints };
                    }
                    return prev;
                });
            }
        });

        // Listen to private user profile
        const profileRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(profileRef, async (profileSnap) => {
          if (profileSnap.exists()) {
            const userProfile = { id: firebaseUser.uid, ...profileSnap.data() } as User;
            const userPicks = await getUserPicks(firebaseUser.uid);
            
            // Merge with existing state to preserve rank/points from public listener if it fired first
            setUser(prev => ({
                ...userProfile,
                rank: prev?.rank,
                totalPoints: prev?.totalPoints
            }));
            
            setSeasonPicks(userPicks);
            setIsAuthenticated(true);
          } else {
            console.log("User profile not found. This may occur briefly during sign-up. Waiting for creation...");
          }
        });
      } else {
        // User logged out, clear all state
        setUser(null);
        setSeasonPicks({});
        setRaceResults({});
        setFormLocks({});
        setEventSchedules({});
        setScoringSettings(defaultSettings);
        setLeaderboardCache(null);
        // Reset to default constants
        setAllDrivers(DRIVERS);
        setAllConstructors(CONSTRUCTORS);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });
    
    return () => {
      unsubscribeAuth();
      unsubscribeResults();
      unsubscribeLocks();
      unsubscribeProfile();
      unsubscribePoints();
      unsubscribeSchedules();
      unsubscribePublicProfile();
    };
  }, []);

  // Ensure scroll resets to top whenever the active page changes
  useEffect(() => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
    }
    // Also scroll window for mobile if layout behaves as document flow
    window.scrollTo(0, 0);
  }, [activePage, adminSubPage]);

  const handlePicksSubmit = async (eventId: string, picks: PickSelection) => {
    if (!user) return;
    try {
      await saveUserPicks(user.id, eventId, picks, !!user.isAdmin);
      const updatedPicks = await getUserPicks(user.id);
      setSeasonPicks(updatedPicks);
      showToast(`Picks for ${eventId} submitted successfully!`, 'success');
    } catch (error) {
      console.error("Failed to submit picks:", error);
      showToast(`Error: Could not submit picks for ${eventId}. Please check your connection and try again.`, 'error');
    }
  };
  
  const handleLogout = async () => {
    try {
      await sessionLogout();
    } catch (error) {
      console.error("Logout error", error);
    }
    // State clearing is handled by onAuthStateChanged listener
  };

  const handleResultsUpdate = async (eventId: string, results: any) => {
    const newResults = { ...raceResults, [eventId]: results };
    try {
      await saveRaceResults(newResults);
    } catch (error) {
      console.error("Failed to save race results:", error);
      throw error;
    }
  };
  
  const handleToggleFormLock = async (eventId: string) => {
    const originalLocks = { ...formLocks };
    const newLocks = { ...formLocks, [eventId]: !formLocks[eventId] };
    setFormLocks(newLocks); // Optimistic UI update

    try {
      await saveFormLocks(newLocks);
    } catch (error) {
      console.error("Failed to save form locks:", error);
      showToast(`Error: Could not update lock status for ${eventId}. Reverting change.`, 'error');
      setFormLocks(originalLocks);
    }
  };

  const handleEntitiesUpdate = (newDrivers: Driver[], newConstructors: Constructor[]) => {
    setAllDrivers(newDrivers);
    setAllConstructors(newConstructors);
  };

  // Callback for when admin updates schedule
  const handleScheduleUpdate = async () => {
      const schedules = await getEventSchedules();
      setEventSchedules(schedules);
  };

  const navigateToPage = (page: Page, params?: { eventId?: string }) => {
    if (page === 'admin' && activePage !== 'admin') {
      setAdminSubPage('dashboard');
    }
    if (params?.eventId) {
        setTargetEventId(params.eventId);
    } else {
        setTargetEventId(null);
    }
    setActivePage(page);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <Dashboard user={user} setActivePage={navigateToPage} raceResults={raceResults} pointsSystem={activePointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} events={mergedEvents} />;
      case 'picks':
        if (user) return <HomePage 
            user={user} 
            seasonPicks={seasonPicks} 
            onPicksSubmit={handlePicksSubmit} 
            formLocks={formLocks} 
            pointsSystem={activePointsSystem} 
            allDrivers={allDrivers} 
            allConstructors={allConstructors} 
            events={mergedEvents} 
            initialEventId={targetEventId}
        />;
        return null;
      case 'leaderboard':
        return <LeaderboardPage 
            currentUser={user} 
            raceResults={raceResults} 
            pointsSystem={activePointsSystem} 
            allDrivers={allDrivers} 
            allConstructors={allConstructors} 
            events={mergedEvents}
            leaderboardCache={leaderboardCache}
            refreshLeaderboard={fetchLeaderboardData}
        />;
      case 'events-hub':
        // Legacy redirect to League Hub if accessed directly, though navigation links should be updated
        return <LeagueHubPage setActivePage={navigateToPage} user={user} />;
      case 'league-hub':
        return <LeagueHubPage setActivePage={navigateToPage} user={user} />;
      case 'gp-results':
        return <GpResultsPage raceResults={raceResults} allDrivers={allDrivers} allConstructors={allConstructors} events={mergedEvents} />;
      case 'profile':
        if(user) return <ProfilePage user={user} seasonPicks={seasonPicks} raceResults={raceResults} pointsSystem={activePointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} setActivePage={navigateToPage} events={mergedEvents} />;
        return null;
      case 'points':
        return <PointsTransparency pointsSystem={activePointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} />;
      case 'drivers-teams':
        return <DriversTeamsPage allDrivers={allDrivers} allConstructors={allConstructors} setActivePage={navigateToPage} />;
      case 'schedule':
        return <SchedulePage schedules={eventSchedules} events={mergedEvents} />;
      case 'donate':
        return <DonationPage user={user} setActivePage={navigateToPage} />;
      case 'duesPayment':
        if(user) {
            if (user.duesPaidStatus === 'Paid') {
                return <Dashboard user={user} setActivePage={navigateToPage} raceResults={raceResults} pointsSystem={activePointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} events={mergedEvents} />;
            }
            return <DuesPaymentPage user={user} setActivePage={navigateToPage} />;
        }
        return null;
      case 'admin':
        if (!isUserAdmin(user)) {
            return <Dashboard user={user} setActivePage={navigateToPage} raceResults={raceResults} pointsSystem={activePointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} events={mergedEvents} />;
        }
        switch (adminSubPage) {
            case 'dashboard':
                return <AdminPage setAdminSubPage={setAdminSubPage} />;
            case 'results':
                return <ResultsManagerPage raceResults={raceResults} onResultsUpdate={handleResultsUpdate} setAdminSubPage={setAdminSubPage} allDrivers={allDrivers} formLocks={formLocks} onToggleLock={handleToggleFormLock} activePointsSystem={activePointsSystem} events={mergedEvents} />;
            case 'manage-users':
                return <ManageUsersPage setAdminSubPage={setAdminSubPage} raceResults={raceResults} pointsSystem={activePointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} events={mergedEvents} />;
            case 'scoring':
                return <ScoringSettingsPage settings={scoringSettings} setAdminSubPage={setAdminSubPage} />;
            case 'entities':
                return <ManageEntitiesPage setAdminSubPage={setAdminSubPage} currentDrivers={allDrivers} currentConstructors={allConstructors} onUpdateEntities={handleEntitiesUpdate} />;
            case 'schedule':
                return <ManageSchedulePage setAdminSubPage={setAdminSubPage} existingSchedules={eventSchedules} onScheduleUpdate={handleScheduleUpdate} />;
            case 'simulation':
                return <AdminSimulationPage setAdminSubPage={setAdminSubPage} pointsSystem={activePointsSystem} />;
            case 'invitations':
                return <AdminInvitationPage setAdminSubPage={setAdminSubPage} user={user} />;
            default:
                return <AdminPage setAdminSubPage={setAdminSubPage} />;
        }
      default:
        return <Dashboard user={user} setActivePage={navigateToPage} raceResults={raceResults} pointsSystem={activePointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} events={mergedEvents} />;
    }
  };
  
   if (isLoading) {
    return <AppSkeleton />;
  }

  // Changed layout structure: fixed full screen shell with scrollable inner container
  // This ensures scrolling happens on the inner div on all devices, fixing the scroll reset issue
  const appContent = (
    <div className="fixed inset-0 bg-carbon-black text-ghost-white flex flex-col md:flex-row overflow-hidden">
      <SideNav user={user} activePage={activePage} navigateToPage={navigateToPage} handleLogout={handleLogout} livePoints={currentTotalPoints} />
      
      {/* Main Column */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Mobile Header */}
        <header className="relative py-4 px-6 grid grid-cols-3 items-center bg-carbon-black/50 backdrop-blur-sm border-b border-accent-gray md:hidden flex-shrink-0 z-50">
         {user ? (
           <>
             <div onClick={() => navigateToPage('home')} className="cursor-pointer justify-self-start">
               <F1CarIcon className="w-10 h-10 text-primary-red" aria-hidden="true" />
             </div>
             <div className="text-center justify-self-center">
                <span className="font-semibold text-lg truncate">{getUserRealName(user)}</span>
             </div>
             <button onClick={handleLogout} className="text-sm font-medium text-highlight-silver hover:text-primary-red transition-colors justify-self-end">
               Log Out
             </button>
           </>
         ) : (
           <div onClick={() => navigateToPage('home')} className="flex items-center gap-2 cursor-pointer col-span-3 justify-center">
             <F1CarIcon className="w-10 h-10 text-primary-red" />
             <span className="font-bold text-xl">F1 Fantasy</span>
           </div>
         )}
        </header>

        {/* 
          Main Content Container (Scrollable Area)
          Using flex-1 with overflow-y-auto ensures THIS element scrolls, not the body.
          pb-[6rem] accounts for bottom nav on mobile.
          
          UPDATE: Conditionally apply md:overflow-hidden for pages that handle their own internal scrolling (Flex-Lock).
        */}
        <div 
            ref={scrollContainerRef} 
            className={`relative flex-1 overflow-y-auto pb-[6rem] pb-safe ${isLockedLayout ? 'md:overflow-hidden md:pb-0' : 'md:pb-8'}`}
        >
            {/* Replaced broken image with CSS Class 'bg-carbon-fiber' defined in index.html */}
            <div className="absolute inset-0 bg-carbon-fiber opacity-10 pointer-events-none fixed"></div>
            
            {/* Main Wrapper: Needs full height if locked to allow children to expand */}
            <main className={`relative p-4 md:p-8 ${isLockedLayout ? 'h-full' : 'min-h-full'}`}>
                {/* Wrap main content in ErrorBoundary. Key ensures it resets on page change. */}
                <ErrorBoundary key={`${activePage}-${adminSubPage}`}>
                    {renderPage()}
                </ErrorBoundary>
            </main>
        </div>

        {/* 
            Mobile Bottom Navigation
            Fixed position inside the flex container, overlaid at bottom
        */}
        <nav className={`absolute bottom-0 left-0 right-0 bg-carbon-black/90 backdrop-blur-lg border-t border-accent-gray/50 grid ${isUserAdmin(user) ? 'grid-cols-6' : 'grid-cols-5'} md:hidden z-50 pb-safe`}>
            <NavItem icon={HomeIcon} label="Home" page="home" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={ProfileIcon} label="Profile" page="profile" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={PicksIcon} label="Picks" page="picks" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={LeagueIcon} label="League" page="league-hub" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={LeaderboardIcon} label="Standings" page="leaderboard" activePage={activePage} setActivePage={navigateToPage} />
            {isUserAdmin(user) && (
              <NavItem icon={AdminIcon} label="Admin" page="admin" activePage={activePage} setActivePage={navigateToPage} />
            )}
        </nav>

        {/* Session Warning Modal */}
        <SessionWarningModal 
            isOpen={showWarning} 
            expiryTime={idleExpiryTime} 
            onContinue={continueSession} 
            onLogout={handleLogout} 
        />
      </div>
    </div>
  );

  const authFlow = (
    <div className="min-h-screen bg-carbon-black text-pure-white flex items-center justify-center p-4">
      <AuthScreen />
    </div>
  );
  
  return isAuthenticated ? appContent : authFlow;
};

interface NavItemProps {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  page: Page;
  activePage: Page;
  setActivePage: (page: Page) => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, page, activePage, setActivePage }) => {
  const isActive = activePage === page;
  return (
    <button
      onClick={() => setActivePage(page)}
      className={`flex flex-col items-center justify-center w-full pt-3 pb-2 transition-colors duration-200 active:scale-95 ${isActive ? 'text-primary-red' : 'text-highlight-silver hover:text-pure-white'}`}
    >
      <Icon className="w-6 h-6 mb-1" />
      <span className="text-[10px] font-medium tracking-tight">{label}</span>
    </button>
  );
};


export default App;
