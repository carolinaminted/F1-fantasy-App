import React, { useState } from 'react';
import { F1FantasyLogo } from './icons/F1FantasyLogo';

interface AuthScreenProps {
  onLogin: (userData: { displayName: string, email: string }) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleLogoClick = () => {
    if (isLogin) {
      setEmail('admin@fantasy.f1');
      setPassword('password123');
    } else {
      const randomId = Math.floor(Math.random() * 1000);
      setDisplayName('Test Principal');
      setEmail(`test.user.${randomId}@fantasy.f1`);
      setPassword('password123');
    }
  };

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 ring-1 ring-white/10">
        <div 
          className="flex flex-col items-center mb-6 cursor-pointer"
          onClick={handleLogoClick}
          title={isLogin ? "Click to fill admin credentials" : "Click to fill test user data"}
        >
          <F1FantasyLogo className="w-40 h-auto mb-4"/>
          <h2 className="text-3xl font-bold text-white text-center">{isLogin ? 'Team Principal Login' : 'Create Account'}</h2>
          <p className="text-gray-400 mt-2 text-center">
            {isLogin ? 'Enter your credentials to manage your team.' : 'Join the league to start competing.'}
          </p>
        </div>
        
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onLogin({ displayName: displayName || 'Team Principal', email }); }}>
          {!isLogin && (
            <div>
              <label className="text-sm font-bold text-gray-300" htmlFor="displayName">Display Name</label>
              <input 
                type="text" 
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Awesome Racing"
                className="mt-1 block w-full bg-gray-900/50 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-[#ff8400] focus:border-[#ff8400]"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-bold text-gray-300" htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="principal@example.com"
              className="mt-1 block w-full bg-gray-900/50 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-[#ff8400] focus:border-[#ff8400]"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-300" htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full bg-gray-900/50 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-[#ff8400] focus:border-[#ff8400]"
            />
          </div>
          <div className="pt-4">
             <button
                type="submit"
                className="w-full bg-[#ff8400] hover:bg-orange-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 shadow-lg shadow-orange-500/20"
              >
                {isLogin ? 'Log In' : 'Sign Up'}
              </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-gray-400 hover:text-[#ff8400]">
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;