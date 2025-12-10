
import React, { useState } from 'react';
import { F1FantasyLogo } from './icons/F1FantasyLogo.tsx';
import { auth } from '../services/firebase.ts';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from '@firebase/auth';
import { createUserProfileDocument } from '../services/firestoreService.ts';

const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogoClick = () => {
    if (isLogin) {
      setEmail('admin@fantasy.f1');
      setPassword('password123');
    } else {
      const randomId = Math.floor(Math.random() * 1000);
      setFirstName('Test');
      setLastName('Principal');
      setDisplayName('Test Principal');
      setEmail(`test.user.${randomId}@fantasy.f1`);
      setPassword('password123');
      setConfirmPassword('password123');
    }
     setError(null);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);

      if (isLogin) {
          try {
              await signInWithEmailAndPassword(auth, email, password);
              // Auth state change will be caught by the listener in App.tsx
          } catch (error: any) {
              // Provide a generic error message for any login failure to prevent user enumeration
              // and handle different Firebase error codes gracefully.
              setError('Invalid email or password. Please try again.');
              console.error("Login error:", error);
              setIsLoading(false);
          }
      } else {
          if (!firstName.trim()) {
              setError('First Name is required.');
              setIsLoading(false);
              return;
          }
          if (!lastName.trim()) {
              setError('Last Name is required.');
              setIsLoading(false);
              return;
          }
          if (!displayName.trim()) {
              setError('Please enter a display name.');
              setIsLoading(false);
              return;
          }
          if (password !== confirmPassword) {
              setError('Passwords do not match.');
              setIsLoading(false);
              return;
          }
          try {
              const userCredential = await createUserWithEmailAndPassword(auth, email, password);
              const user = userCredential.user;
              try {
                  await createUserProfileDocument(user, { displayName, firstName, lastName });
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
                setError('This email is already in use. Please log in or use a different email.');
              } else {
                setError('Failed to sign up. Please try again.');
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
            <>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-bold text-ghost-white" htmlFor="firstName">First Name</label>
                        <input 
                            type="text" 
                            id="firstName"
                            value={firstName}
                            onChange={(e) => {
                                setFirstName(e.target.value);
                                setError(null);
                            }}
                            placeholder="John"
                            required
                            className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-ghost-white" htmlFor="lastName">Last Name</label>
                        <input 
                            type="text" 
                            id="lastName"
                            value={lastName}
                            onChange={(e) => {
                                setLastName(e.target.value);
                                setError(null);
                            }}
                            placeholder="Doe"
                            required
                            className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
                        />
                    </div>
                </div>
                <div>
                <label className="text-sm font-bold text-ghost-white" htmlFor="displayName">Display Name</label>
                <input 
                    type="text" 
                    id="displayName"
                    value={displayName}
                    onChange={(e) => {
                        setDisplayName(e.target.value);
                        setError(null);
                    }}
                    placeholder="e.g. Awesome Racing"
                    required
                    className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
                />
                </div>
            </>
          )}
          <div>
            <label className="text-sm font-bold text-ghost-white" htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email"
              value={email}
              onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
              }}
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
              onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
              }}
              placeholder="••••••••"
              required
              minLength={6}
              className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
            />
          </div>
          {!isLogin && (
            <div>
              <label className="text-sm font-bold text-ghost-white" htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                }}
                placeholder="••••••••"
                required
                className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
              />
            </div>
          )}
          
          {error && <p className="text-sm text-primary-red text-center pt-2">{error}</p>}

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
          <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-sm text-highlight-silver hover:text-primary-red">
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
