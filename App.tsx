// Fix: Implement the main App component to provide structure, state management, and navigation.
import React, { useState } from 'react';
import AuthScreen from './components/AuthScreen';
import HomePage from './components/HomePage';
import ProfilePage from './components/ProfilePage';
import LeaderboardPage from './components/LeaderboardPage';
import Dashboard from './components/Dashboard';
import AdminPage from './components/AdminPage';
import FormLockPage from './components/FormLockPage';
import ResultsManagerPage from './components/ResultsManagerPage';
import { User, PickSelection, RaceResults } from './types';
import { HomeIcon } from './components/icons/HomeIcon';
import { PicksIcon } from './components/icons/PicksIcon';
import { ProfileIcon } from './components/icons/ProfileIcon';
import { LeaderboardIcon } from './components/icons/LeaderboardIcon';
import { F1CarIcon } from './components/icons/F1CarIcon';
import { AdminIcon } from './components/icons/AdminIcon';
import { MOCK_USERS, MOCK_SEASON_PICKS, RACE_RESULTS, FORM_LOCKS } from './constants';


export type Page = 'home' | 'picks' | 'leaderboard' | 'profile' | 'admin';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activePage, setActivePage] = useState<Page>('home');
  const [adminSubPage, setAdminSubPage] = useState<'dashboard' | 'results' | 'form-lock'>('dashboard');
  const [seasonPicks, setSeasonPicks] = useState<{ [eventId: string]: PickSelection }>({});
  const [raceResults, setRaceResults] = useState<RaceResults>(RACE_RESULTS);
  const [formLocks, setFormLocks] = useState<{ [eventId: string]: boolean }>(FORM_LOCKS);
  
  const handlePicksSubmit = (eventId: string, picks: PickSelection) => {
    setSeasonPicks(prev => ({ ...prev, [eventId]: picks }));
     if (user) {
        if (!MOCK_SEASON_PICKS[user.id]) {
            MOCK_SEASON_PICKS[user.id] = {};
        }
        MOCK_SEASON_PICKS[user.id][eventId] = picks;
    }
  };

  const handleLogin = (userData: { displayName: string, email: string }) => {
    let loggedInUser = MOCK_USERS.find(u => u.email.toLowerCase() === userData.email.toLowerCase());

    if (!loggedInUser) {
        const newId = `user-${Date.now()}`;
        loggedInUser = { 
            id: newId, 
            displayName: userData.displayName || `Principal-${Math.floor(Math.random() * 1000)}`,
            email: userData.email 
        };
        MOCK_USERS.push(loggedInUser);
        MOCK_SEASON_PICKS[newId] = {};
    }

    setUser(loggedInUser);
    setIsAuthenticated(true);
    setActivePage('home');
    setAdminSubPage('dashboard');
    setSeasonPicks(MOCK_SEASON_PICKS[loggedInUser.id] || {});
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setSeasonPicks({});
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
  
  const appContent = (
    <div className="relative min-h-screen bg-carbon-black text-ghost-white pb-24">
       <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{backgroundImage: "url('https://www.formula1.com/etc/designs/fom-website/images/patterns/carbon-fibre-v2.png')"}}></div>
       
       <header className="relative py-4 px-6 flex items-center justify-between bg-carbon-black/50 backdrop-blur-sm border-b border-accent-gray">
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

       <main className="relative p-4 md:p-8">
         {renderPage()}
       </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-carbon-black/80 backdrop-blur-lg border-t border-accent-gray/50 flex justify-around md:hidden">
        <NavItem icon={HomeIcon} label="Home" page="home" activePage={activePage} setActivePage={navigateToPage} />
        <NavItem icon={PicksIcon} label="Picks" page="picks" activePage={activePage} setActivePage={navigateToPage} />
        <NavItem icon={LeaderboardIcon} label="Leaderboard" page="leaderboard" activePage={activePage} setActivePage={navigateToPage} />
        <NavItem icon={ProfileIcon} label="Profile" page="profile" activePage={activePage} setActivePage={navigateToPage} />
        {user?.email === 'admin@fantasy.f1' && (
          <NavItem icon={AdminIcon} label="Admin" page="admin" activePage={activePage} setActivePage={navigateToPage} />
        )}
      </nav>
    </div>
  );

  const authFlow = (
    <div className="min-h-screen bg-carbon-black text-pure-white flex items-center justify-center p-4" style={{backgroundImage: "url('https://www.formula1.com/etc/designs/fom-website/images/patterns/carbon-fibre-v2.png')"}}>
      <AuthScreen onLogin={handleLogin} />
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