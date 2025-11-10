// Fix: Implement the main App component to provide structure, state management, and navigation.
import React, { useState, useEffect } from 'react';
import AuthScreen from './components/AuthScreen.tsx';
import HomePage from './components/HomePage.tsx';
import ProfilePage from './components/ProfilePage.tsx';
import LeaderboardPage from './components/LeaderboardPage.tsx';
import Dashboard from './components/Dashboard.tsx';
import AdminPage from './components/AdminPage.tsx';
import FormLockPage from './components/FormLockPage.tsx';
import ResultsManagerPage from './components/ResultsManagerPage.tsx';
import PointsTransparency from './components/PointsTransparency.tsx';
import { User, PickSelection, RaceResults } from './types.ts';
import { HomeIcon } from './components/icons/HomeIcon.tsx';
import { PicksIcon } from './components/icons/PicksIcon.tsx';
import { ProfileIcon } from './components/icons/ProfileIcon.tsx';
import { LeaderboardIcon } from './components/icons/LeaderboardIcon.tsx';
import { F1CarIcon } from './components/icons/F1CarIcon.tsx';
import { AdminIcon } from './components/icons/AdminIcon.tsx';
import { TrophyIcon } from './components/icons/TrophyIcon.tsx';
import { MOCK_SEASON_PICKS, RACE_RESULTS, FORM_LOCKS } from './constants.ts';
import { auth } from './services/firebase.ts';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getUserProfile, getUserPicks, saveUserPicks } from './services/firestoreService.ts';


export type Page = 'home' | 'picks' | 'leaderboard' | 'profile' | 'admin' | 'points';


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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 w-full text-left ${
        isActive
          ? 'bg-accent-gray text-pure-white font-semibold'
          : 'text-highlight-silver hover:bg-accent-gray/50 hover:text-pure-white'
      }`}
    >
      <Icon className={`w-6 h-6 flex-shrink-0 ${isActive ? 'text-primary-red' : ''}`} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

// New SideNav component for desktop view
const SideNav: React.FC<{ user: User | null; activePage: Page; navigateToPage: (page: Page) => void; handleLogout: () => void }> = ({ user, activePage, navigateToPage, handleLogout }) => (
    <aside className="hidden md:flex flex-col w-56 bg-carbon-black border-r border-accent-gray p-4 flex-shrink-0">
        <div onClick={() => navigateToPage('home')} className="flex items-center gap-2 cursor-pointer pt-2 pb-4 mb-4">
           <F1CarIcon className="w-8 h-8 text-primary-red" />
           <span className="font-bold text-xl">F1 Fantasy</span>
        </div>
        <nav className="flex-grow space-y-1">
            <SideNavItem icon={HomeIcon} label="Dashboard" page="home" activePage={activePage} setActivePage={navigateToPage} />
            <SideNavItem icon={PicksIcon} label="Weekly Picks" page="picks" activePage={activePage} setActivePage={navigateToPage} />
            <SideNavItem icon={LeaderboardIcon} label="Leaderboard" page="leaderboard" activePage={activePage} setActivePage={navigateToPage} />
            <SideNavItem icon={TrophyIcon} label="Points System" page="points" activePage={activePage} setActivePage={navigateToPage} />
            <SideNavItem icon={ProfileIcon} label="My Profile" page="profile" activePage={activePage} setActivePage={navigateToPage} />
            {user?.email === 'admin@fantasy.f1' && (
              <SideNavItem icon={AdminIcon} label="Admin Panel" page="admin" activePage={activePage} setActivePage={navigateToPage} />
            )}
        </nav>
         {user && (
           <div className="mt-auto flex-shrink-0">
             <div className="pt-4 border-t border-accent-gray/50">
                <p className="font-semibold text-pure-white truncate">{user.displayName}</p>
                 <button onClick={handleLogout} className="text-sm text-highlight-silver hover:text-primary-red w-full text-left">
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
  const [adminSubPage, setAdminSubPage] = useState<'dashboard' | 'results' | 'form-lock'>('dashboard');
  const [seasonPicks, setSeasonPicks] = useState<{ [eventId: string]: PickSelection }>({});
  const [raceResults, setRaceResults] = useState<RaceResults>(RACE_RESULTS);
  const [formLocks, setFormLocks] = useState<{ [eventId: string]: boolean }>(FORM_LOCKS);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        let userProfile = await getUserProfile(firebaseUser.uid);

        // This handles a race condition on new user registration where the auth listener
        // fires before the user's profile document is created in Firestore.
        if (!userProfile) {
          console.log("Profile not found on initial load, retrying for new user...");
          // Wait a moment for Firestore to be updated
          await new Promise(resolve => setTimeout(resolve, 1500));
          userProfile = await getUserProfile(firebaseUser.uid);
        }

        if (userProfile) {
          // Profile found, proceed to load user data
          const userPicks = await getUserPicks(firebaseUser.uid);
          setUser(userProfile);
          setSeasonPicks(userPicks);
          setIsAuthenticated(true);
        } else {
          // If the profile still doesn't exist after the retry, something went wrong with registration.
          // Log the user out to prevent them from being in a broken, authenticated-but-no-profile state.
          console.error("User profile document not found after retry. Forcing logout.");
          await signOut(auth);
          // The signOut will re-trigger this listener, falling into the `else` block below.
          return; // Exit early to avoid setting loading to false here
        }
      } else {
        // User is logged out
        setUser(null);
        setSeasonPicks({});
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handlePicksSubmit = async (eventId: string, picks: PickSelection) => {
    if (!user) return;
    await saveUserPicks(user.id, eventId, picks);
    // Refresh picks from DB to ensure UI consistency
    const updatedPicks = await getUserPicks(user.id);
    setSeasonPicks(updatedPicks);
    alert(`Picks for ${eventId} submitted successfully!`);
  };
  
  const handleLogout = () => {
    signOut(auth);
    setActivePage('home');
    setAdminSubPage('dashboard');
  };

  const handleResultsUpdate = (eventId: string, results: any) => {
    const newResults = { ...raceResults, [eventId]: results };
    setRaceResults(newResults);
    RACE_RESULTS[eventId] = results; // Also update the mutable constant
    alert(`${eventId} results updated successfully!`);
  };
  
  const handleToggleFormLock = (eventId: string) => {
    const newLocks = { ...formLocks, [eventId]: !formLocks[eventId] };
    setFormLocks(newLocks);
    FORM_LOCKS[eventId] = !FORM_LOCKS[eventId]; // Update mutable constant
    alert(`Form for event ${eventId} has been ${newLocks[eventId] ? 'LOCKED' : 'UNLOCKED'}.`);
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
        if (user) return <HomePage user={user} seasonPicks={seasonPicks} onPicksSubmit={handlePicksSubmit} formLocks={formLocks} />;
        return null;
      case 'leaderboard':
        return <LeaderboardPage currentUser={user} raceResults={raceResults} />;
      case 'profile':
        if(user) return <ProfilePage user={user} seasonPicks={seasonPicks} raceResults={raceResults} />;
        return null; // Should not happen if authenticated
      case 'points':
        return <PointsTransparency />;
      case 'admin':
        if (user?.email !== 'admin@fantasy.f1') {
            return <Dashboard user={user} setActivePage={navigateToPage} />; // Redirect non-admins
        }
        switch (adminSubPage) {
            case 'dashboard':
                return <AdminPage setAdminSubPage={setAdminSubPage} />;
            case 'results':
                return <ResultsManagerPage raceResults={raceResults} onResultsUpdate={handleResultsUpdate} setAdminSubPage={setAdminSubPage} />;
            case 'form-lock':
                return <FormLockPage formLocks={formLocks} onToggleLock={handleToggleFormLock} setAdminSubPage={setAdminSubPage} />;
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
      {/* Sidebar for Desktop */}
      <SideNav user={user} activePage={activePage} navigateToPage={navigateToPage} handleLogout={handleLogout} />

      <div className="flex-1 flex flex-col md:h-screen md:overflow-hidden">
        {/* Header for Mobile */}
        <header className="relative py-4 px-6 flex items-center justify-between bg-carbon-black/50 backdrop-blur-sm border-b border-accent-gray md:hidden">
         <div onClick={() => navigateToPage('home')} className="flex items-center gap-2 cursor-pointer">
           <F1CarIcon className="w-8 h-8 text-primary-red" />
           <span className="font-bold text-xl">F1 Fantasy</span>
         </div>
         {user && (
           <div className="text-right">
             <p className="font-semibold">{user.displayName}</p>
             <button onClick={handleLogout} className="text-sm text-highlight-silver hover:text-pure-white">
               Log Out
             </button>
           </div>
         )}
        </header>

        {/* Main Content (scrollable) */}
        <div className="relative flex-1 overflow-y-auto pb-24 md:pb-8">
            <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{backgroundImage: "url('https://www.formula1.com/etc/designs/fom-website/images/patterns/carbon-fibre-v2.png')"}}></div>
            <main className="relative p-4 md:p-8">
                {renderPage()}
            </main>
        </div>

        {/* Bottom Nav for Mobile */}
        <nav className="fixed bottom-0 left-0 right-0 bg-carbon-black/80 backdrop-blur-lg border-t border-accent-gray/50 flex justify-around md:hidden">
            <NavItem icon={HomeIcon} label="Home" page="home" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={PicksIcon} label="Picks" page="picks" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={LeaderboardIcon} label="Leaderboard" page="leaderboard" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={TrophyIcon} label="Points" page="points" activePage={activePage} setActivePage={navigateToPage} />
            <NavItem icon={ProfileIcon} label="Profile" page="profile" activePage={activePage} setActivePage={navigateToPage} />
            {user?.email === 'admin@fantasy.f1' && (
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