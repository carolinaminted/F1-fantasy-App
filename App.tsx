
// Fix: Implement the main App component to provide structure, state management, and navigation.
import React, { useState, useEffect } from 'react';
import AuthScreen from './components/AuthScreen.tsx';
import HomePage from './components/HomePage.tsx';
import ProfilePage from './components/ProfilePage.tsx';
import LeaderboardPage from './components/LeaderboardPage.tsx';
import Dashboard from './components/Dashboard.tsx';
import AdminPage from './components/AdminPage.tsx';
import ResultsManagerPage from './components/ResultsManagerPage.tsx';
import DuesStatusManagerPage from './components/DuesStatusManagerPage.tsx';
import ManageUsersPage from './components/ManageUsersPage.tsx';
import ManageEntitiesPage from './components/ManageEntitiesPage.tsx'; // New
import AdminSimulationPage from './components/AdminSimulationPage.tsx';
import ScoringSettingsPage from './components/ScoringSettingsPage.tsx';
import PointsTransparency from './components/PointsTransparency.tsx';
import DonationPage from './components/DonationPage.tsx';
import DuesPaymentPage from './components/DuesPaymentPage.tsx';
import GpResultsPage from './components/GpResultsPage.tsx';
import { User, PickSelection, RaceResults, PointsSystem, Driver, Constructor } from './types.ts';
import { HomeIcon } from './components/icons/HomeIcon.tsx';
import { DonationIcon } from './components/icons/DonationIcon.tsx';
import { PicksIcon } from './components/icons/PicksIcon.tsx';
import { ProfileIcon } from './components/icons/ProfileIcon.tsx';
import { LeaderboardIcon } from './components/icons/LeaderboardIcon.tsx';
import { F1CarIcon } from './components/icons/F1CarIcon.tsx';
import { AdminIcon } from './components/icons/AdminIcon.tsx';
import { TrophyIcon } from './components/icons/TrophyIcon.tsx';
import { TrackIcon } from './components/icons/TrackIcon.tsx';
import { RACE_RESULTS, DEFAULT_POINTS_SYSTEM, DRIVERS, CONSTRUCTORS } from './constants.ts';
import { auth, db } from './services/firebase.ts';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { onAuthStateChanged, signOut } from '@firebase/auth';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { onSnapshot, doc } from '@firebase/firestore';
import { getUserProfile, getUserPicks, saveUserPicks, saveFormLocks, saveRaceResults, savePointsSystem, getLeagueEntities, saveLeagueEntities } from './services/firestoreService.ts';


export type Page = 'home' | 'picks' | 'leaderboard' | 'profile' | 'admin' | 'points' | 'donate' | 'gp-results' | 'duesPayment';


// New SideNavItem component for desktop sidebar
interface SideNavItemProps {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  page: Page;
  activePage: Page;
  setActivePage: (page: Page) => void;
}

const SideNavItem: React.FC<SideNavItemProps> = ({ icon: Icon, label, page, activePage, setActivePage }) => {
  const isActive = activePage === page;
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
    if (!user) return false;
    return !!user.isAdmin || user.email === 'admin@fantasy.f1';
};

// New SideNav component for desktop view
const SideNav: React.FC<{ user: User | null; activePage: Page; navigateToPage: (page: Page) => void; handleLogout: () => void }> = ({ user, activePage, navigateToPage, handleLogout }) => (
    <aside className="hidden md:flex flex-col w-64 bg-carbon-black border-r border-accent-gray p-4 flex-shrink-0">
        <div onClick={() => navigateToPage('home')} className="flex items-center gap-3 cursor-pointer pt-2 pb-4 mb-4">
           <F1CarIcon className="w-12 h-12 text-primary-red" />
           <span className="font-bold text-2xl truncate">{user?.displayName}</span>
        </div>
        <nav className="flex-grow space-y-1">
            <SideNavItem icon={HomeIcon} label="Home" page="home" activePage={activePage} setActivePage={navigateToPage} />
            <SideNavItem icon={ProfileIcon} label="Profile" page="profile" activePage={activePage} setActivePage={navigateToPage} />
            <SideNavItem icon={PicksIcon} label="GP Picks" page="picks" activePage={activePage} setActivePage={navigateToPage} />
            <SideNavItem icon={LeaderboardIcon} label="Leaderboard" page="leaderboard" activePage={activePage} setActivePage={navigateToPage} />
            <SideNavItem icon={TrackIcon} label="GP Results" page="gp-results" activePage={activePage} setActivePage={navigateToPage} />
            <SideNavItem icon={TrophyIcon} label="Scoring System" page="points" activePage={activePage} setActivePage={navigateToPage} />
            <SideNavItem icon={DonationIcon} label="Donate" page="donate" activePage={activePage} setActivePage={navigateToPage} />
            {isUserAdmin(user) && (
              <SideNavItem icon={AdminIcon} label="Admin" page="admin" activePage={activePage} setActivePage={navigateToPage} />
            )}
        </nav>
         {user && (
           <div className="mt-auto flex-shrink-0">
             <div className="pt-4 border-t border-accent-gray/50">
                 <button onClick={handleLogout} className="text-lg font-semibold text-highlight-silver hover:text-primary-red w-full text-left transition-colors">
                    Log Out
                 </button>
             </div>
           </div>
         )}
    </aside>
);


const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePage, setActivePage] = useState<Page>('home');
  const [adminSubPage, setAdminSubPage] = useState<'dashboard' | 'results' | 'dues-status' | 'manage-users' | 'simulation' | 'scoring' | 'entities'>('dashboard');
  const [seasonPicks, setSeasonPicks] = useState<{ [eventId: string]: PickSelection }>({});
  const [raceResults, setRaceResults] = useState<RaceResults>({});
  const [formLocks, setFormLocks] = useState<{ [eventId: string]: boolean }>({});
  const [pointsSystem, setPointsSystem] = useState<PointsSystem>(DEFAULT_POINTS_SYSTEM);
  
  // Dynamic Entities State
  const [allDrivers, setAllDrivers] = useState<Driver[]>(DRIVERS);
  const [allConstructors, setAllConstructors] = useState<Constructor[]>(CONSTRUCTORS);

  useEffect(() => {
    let unsubscribeResults = () => {};
    let unsubscribeLocks = () => {};
    let unsubscribeProfile = () => {};
    let unsubscribePoints = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous listeners before setting new ones or logging out
      unsubscribeResults();
      unsubscribeLocks();
      unsubscribeProfile();
      unsubscribePoints();

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
                setPointsSystem(docSnap.data() as PointsSystem);
            } else {
                console.log("Points system config not found. Seeding default.");
                savePointsSystem(DEFAULT_POINTS_SYSTEM);
            }
        }, (error) => console.error("Firestore listener error (scoring_config):", error));

        // Listen to user-specific data in real-time
        const profileRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(profileRef, async (profileSnap) => {
          if (profileSnap.exists()) {
            const userProfile = { id: firebaseUser.uid, ...profileSnap.data() } as User;
            const userPicks = await getUserPicks(firebaseUser.uid);
            setUser(userProfile);
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
        setPointsSystem(DEFAULT_POINTS_SYSTEM);
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
    };
  }, []);

  const handlePicksSubmit = async (eventId: string, picks: PickSelection) => {
    if (!user) return;
    try {
      await saveUserPicks(user.id, eventId, picks);
      const updatedPicks = await getUserPicks(user.id);
      setSeasonPicks(updatedPicks);
      alert(`Picks for ${eventId} submitted successfully!`);
    } catch (error) {
      console.error("Failed to submit picks:", error);
      alert(`Error: Could not submit picks for ${eventId}. Please check your connection and try again.`);
    }
  };
  
  const handleLogout = () => {
    signOut(auth);
    setActivePage('home');
    setAdminSubPage('dashboard');
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
      alert(`Error: Could not update lock status for ${eventId}. Reverting change.`);
      setFormLocks(originalLocks);
    }
  };

  const handleEntitiesUpdate = (newDrivers: Driver[], newConstructors: Constructor[]) => {
    setAllDrivers(newDrivers);
    setAllConstructors(newConstructors);
  };

  const navigateToPage = (page: Page) => {
    if (page === 'admin' && activePage !== 'admin') {
      setAdminSubPage('dashboard');
    }
    setActivePage(page);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <Dashboard user={user} setActivePage={navigateToPage} />;
      case 'picks':
        if (user) return <HomePage user={user} seasonPicks={seasonPicks} onPicksSubmit={handlePicksSubmit} formLocks={formLocks} pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} />;
        return null;
      case 'leaderboard':
        return <LeaderboardPage currentUser={user} raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} />;
      case 'gp-results':
        return <GpResultsPage raceResults={raceResults} allDrivers={allDrivers} allConstructors={allConstructors} />;
      case 'profile':
        if(user) return <ProfilePage user={user} seasonPicks={seasonPicks} raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} />;
        return null;
      case 'points':
        return <PointsTransparency pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} />;
      case 'donate':
        return <DonationPage user={user} setActivePage={navigateToPage} />;
      case 'duesPayment':
        if(user) {
            if (user.duesPaidStatus === 'Paid') {
                return <Dashboard user={user} setActivePage={navigateToPage} />;
            }
            return <DuesPaymentPage user={user} setActivePage={navigateToPage} />;
        }
        return null;
      case 'admin':
        if (!isUserAdmin(user)) {
            return <Dashboard user={user} setActivePage={navigateToPage} />;
        }
        switch (adminSubPage) {
            case 'dashboard':
                return <AdminPage setAdminSubPage={setAdminSubPage} />;
            case 'results':
                return <ResultsManagerPage raceResults={raceResults} onResultsUpdate={handleResultsUpdate} setAdminSubPage={setAdminSubPage} allDrivers={allDrivers} formLocks={formLocks} onToggleLock={handleToggleFormLock} />;
            case 'dues-status':
                return <DuesStatusManagerPage setAdminSubPage={setAdminSubPage} />;
            case 'manage-users':
                return <ManageUsersPage setAdminSubPage={setAdminSubPage} raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} />;
            case 'simulation':
                return <AdminSimulationPage setAdminSubPage={setAdminSubPage} pointsSystem={pointsSystem} />;
            case 'scoring':
                return <ScoringSettingsPage currentConfig={pointsSystem} setAdminSubPage={setAdminSubPage} />;
            case 'entities':
                return <ManageEntitiesPage setAdminSubPage={setAdminSubPage} currentDrivers={allDrivers} currentConstructors={allConstructors} onUpdateEntities={handleEntitiesUpdate} />;
            default:
                return <AdminPage setAdminSubPage={setAdminSubPage} />;
        }
      default:
        return <Dashboard user={user} setActivePage={navigateToPage} />;
    }
  };
  
   if (isLoading) {
    return (
      <div className="min-h-screen bg-carbon-black flex items-center justify-center">
        <F1CarIcon className="w-16 h-16 text-primary-red animate-pulse" />
      </div>
    );
  }

  const appContent = (
    <div className="min-h-screen bg-carbon-black text-ghost-white md:flex">
      <SideNav user={user} activePage={activePage} navigateToPage={navigateToPage} handleLogout={handleLogout} />
      <div className="flex-1 flex flex-col md:h-screen md:overflow-hidden">
        <header className="relative py-4 px-6 grid grid-cols-3 items-center bg-carbon-black/50 backdrop-blur-sm border-b border-accent-gray md:hidden">
         {user ? (
           <>
             <div onClick={() => navigateToPage('home')} className="cursor-pointer justify-self-start">
               <F1CarIcon className="w-10 h-10 text-primary-red" aria-hidden="true" />
             </div>
             <div className="text-center justify-self-center">
                <span className="font-semibold text-lg truncate">{user.displayName}</span>
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

        <div className="relative flex-1 overflow-y-auto pb-24 md:pb-8">
            <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{backgroundImage: "url('https://www.formula1.com/etc/designs/fom-website/images/patterns/carbon-fibre-v2.png')"}}></div>
            <main className="relative p-4 md:p-8">
                {renderPage()}
            </main>
        </div>

        <nav className={`fixed bottom-0 left-0 right-0 bg-carbon-black/80 backdrop-blur-lg border-t border-accent-gray/50 grid ${isUserAdmin(user) ? 'grid-cols-5' : 'grid-cols-4'} md:hidden`}>
            <NavItem icon={HomeIcon} label="Home" page="home" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={PicksIcon} label="Picks" page="picks" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={LeaderboardIcon} label="Leaderboard" page="leaderboard" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={ProfileIcon} label="Profile" page="profile" activePage={activePage} setActivePage={navigateToPage} />
            {isUserAdmin(user) && (
              <NavItem icon={AdminIcon} label="Admin" page="admin" activePage={activePage} setActivePage={navigateToPage} />
            )}
        </nav>
      </div>
    </div>
  );

  const authFlow = (
    <div className="min-h-screen bg-carbon-black text-pure-white flex items-center justify-center p-4" style={{backgroundImage: "url('https://www.formula1.com/etc/designs/fom-website/images/patterns/carbon-fibre-v2.png')"}}>
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
      className={`flex flex-col items-center justify-center w-full pt-3 pb-2 transition-colors duration-200 ${isActive ? 'text-primary-red' : 'text-highlight-silver hover:text-pure-white'}`}
    >
      <Icon className="w-6 h-6 mb-1" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
};


export default App;
