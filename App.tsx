// Fix: Implement the main App component to provide structure, state management, and navigation.
import React, { useState } from 'react';
import AuthScreen from './components/AuthScreen';
import HomePage from './components/HomePage';
import ProfilePage from './components/ProfilePage';
import LeaderboardPage from './components/LeaderboardPage';
import Dashboard from './components/Dashboard';
import { User } from './types';
import { HomeIcon } from './components/icons/HomeIcon';
import { PicksIcon } from './components/icons/PicksIcon';
import { ProfileIcon } from './components/icons/ProfileIcon';
import { LeaderboardIcon } from './components/icons/LeaderboardIcon';
import { F1CarIcon } from './components/icons/F1CarIcon';

export type Page = 'home' | 'picks' | 'leaderboard' | 'profile';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activePage, setActivePage] = useState<Page>('home');
  
  const handleLogin = () => {
    setUser({ id: 'user-001', displayName: 'Team Principal' });
    setIsAuthenticated(true);
    setActivePage('home');
  };
  
  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <Dashboard setActivePage={setActivePage} />;
      case 'picks':
        return <HomePage />;
      case 'leaderboard':
        return <LeaderboardPage />;
      case 'profile':
        if(user) return <ProfilePage user={user} />;
        return null; // Should not happen if authenticated
      default:
        return <Dashboard setActivePage={setActivePage} />;
    }
  };
  
  const appContent = (
    <div className="relative min-h-screen bg-gray-900 text-white pb-24">
       <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{backgroundImage: "url('https://www.formula1.com/etc/designs/fom-website/images/patterns/carbon-fibre-v2.png')"}}></div>
       
       <header className="relative py-4 px-6 flex items-center justify-between bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
         <div onClick={() => setActivePage('home')} className="flex items-center gap-2 cursor-pointer">
           <F1CarIcon className="w-8 h-8 text-[#ff8400]" />
           <span className="font-bold text-xl">F1 Fantasy</span>
         </div>
         {user && (
           <div className="text-right">
             <p className="font-semibold">{user.displayName}</p>
             <button onClick={() => { setIsAuthenticated(false); setUser(null); }} className="text-sm text-gray-400 hover:text-white">
               Log Out
             </button>
           </div>
         )}
       </header>

       <main className="relative p-4 md:p-8">
         {renderPage()}
       </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-lg border-t border-gray-700/50 flex justify-around md:hidden">
        <NavItem icon={HomeIcon} label="Home" page="home" activePage={activePage} setActivePage={setActivePage} />
        <NavItem icon={PicksIcon} label="Picks" page="picks" activePage={activePage} setActivePage={setActivePage} />
        <NavItem icon={LeaderboardIcon} label="Leaderboard" page="leaderboard" activePage={activePage} setActivePage={setActivePage} />
        <NavItem icon={ProfileIcon} label="Profile" page="profile" activePage={activePage} setActivePage={setActivePage} />
      </nav>
    </div>
  );

  const authFlow = (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4" style={{backgroundImage: "url('https://www.formula1.com/etc/designs/fom-website/images/patterns/carbon-fibre-v2.png')"}}>
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
      className={`flex flex-col items-center justify-center w-full pt-3 pb-2 transition-colors duration-200 ${isActive ? 'text-[#ff8400]' : 'text-gray-400 hover:text-white'}`}
    >
      <Icon className="w-6 h-6 mb-1" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
};


export default App;