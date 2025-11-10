import React, { useState } from 'react';
import { F1FantasyLogo } from './icons/F1FantasyLogo.tsx';
import { auth } from '../services/firebase.ts';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { createUserProfileDocument } from '../services/firestoreService.ts';

const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
  
  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);

      if (isLogin) {
          try {
              await signInWithEmailAndPassword(auth, email, password);
              // Auth state change will be caught by the listener in App.tsx
          } catch (error) {
              alert('Failed to log in. Please check your credentials.');
              console.error(error);
              setIsLoading(false);
          }
      } else {
          if (!displayName) {
              alert('Please enter a display name.');
              setIsLoading(false);
              return;
          }
          try {
              const userCredential = await createUserWithEmailAndPassword(auth, email, password);
              const user = userCredential.user;
              try {
                  await createUserProfileDocument(user, { displayName });
                  // On success, the onAuthStateChanged listener handles the redirect, so we don't reset loading state.
              } catch (profileError) {
                  // This is a critical failure: auth user was created, but firestore profile was not.
                  // We should "roll back" the auth user creation to avoid an inconsistent state.
                  console.error("Firestore profile creation failed. Rolling back Auth user.", profileError);
                  if (auth.currentUser) {
                      await deleteUser(auth.currentUser);
                  }
                  // Let the outer catch block handle the UI feedback.
                  throw new Error("Failed to create user profile in the database.");
              }
          } catch (error: any) {
              if (error.code === 'auth/email-already-in-use') {
                alert('This email is already in use. Please log in or use a different email.');
              } else {
                alert('Failed to sign up. Please try again.');
              }
              console.error(error);
              setIsLoading(false);
          }
      }
      // On successful sign-up or sign-in, the component unmounts via the onAuthStateChanged listener,
      // so we don't need to set isLoading to false here. It's only reset on failure.
  };

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="bg-accent-gray/50 backdrop-blur-sm rounded-xl p-8 ring-1 ring-pure-white/10">
        <div 
          className="flex flex-col items-center mb-6 cursor-pointer"
          onClick={handleLogoClick}
          title={isLogin ? "Click to fill admin credentials" : "Click to fill test user data"}
        >
          <F1FantasyLogo className="w-64 h-auto mb-4"/>
        </div>
        
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!isLogin && (
            <div>
              <label className="text-sm font-bold text-ghost-white" htmlFor="displayName">Display Name</label>
              <input 
                type="text" 
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Awesome Racing"
                required
                className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-bold text-ghost-white" htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="principal@example.com"
              required
              className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-ghost-white" htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
            />
          </div>
          <div className="pt-4">
             <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 shadow-lg shadow-primary-red/20 disabled:bg-accent-gray disabled:cursor-wait"
              >
                {isLoading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
              </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-highlight-silver hover:text-primary-red">
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;