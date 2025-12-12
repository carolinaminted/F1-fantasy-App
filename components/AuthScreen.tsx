
import React, { useState } from 'react';
import { F1FantasyLogo } from './icons/F1FantasyLogo.tsx';
import { auth, functions } from '../services/firebase.ts';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser, sendPasswordResetEmail, fetchSignInMethodsForEmail } from '@firebase/auth';
import { httpsCallable } from '@firebase/functions';
import { createUserProfileDocument } from '../services/firestoreService.ts';

const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  
  // Signup Flow State
  const [signupStep, setSignupStep] = useState<'email' | 'code' | 'details'>('email');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  
  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [codeInput, setCodeInput] = useState('');
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetAttempts, setResetAttempts] = useState(0);

  const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  const resetFlows = () => {
      setError(null);
      setResetMessage(null);
      setIsResetting(false);
      setSignupStep('email');
      setCodeInput('');
      setGeneratedCode(null);
      setResetAttempts(0);
      setPassword('');
      setConfirmPassword('');
      // We keep email if populated to be nice
  };

  const handleLogoClick = () => {
    if (!isResetting && signupStep === 'details') {
      const randomId = Math.floor(Math.random() * 1000);
      setFirstName('Test');
      setLastName('Principal');
      setDisplayName('Test Principal');
      if(!email) setEmail(`test.user.${randomId}@fantasy.f1`);
      setPassword('password123');
      setConfirmPassword('password123');
    }
     setError(null);
     setResetMessage(null);
  };

  // --- Step 1: Send Verification Code ---
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Please enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Please enter a valid email address.");

    setIsLoading(true);
    try {
        // Check if user exists
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length > 0) {
            setIsLoading(false);
            return setError("An account with this email already exists. Please log in.");
        }

        // --- ATTEMPT REAL CLOUD FUNCTION ---
        try {
            console.log("Attempting to call backend 'sendVerificationCode'...");
            const sendVerificationCode = httpsCallable(functions, 'sendVerificationCode');
            const result = await sendVerificationCode({ email });
            // If we reach here, the backend successfully sent an email.
            // For security, the backend might handle the code storage, 
            // but for this hybrid implementation, we might receive a hash or status.
            console.log("Backend response:", result.data);
            
            // If backend handles generation, we shouldn't rely on client gen.
            // However, to keep the UI flows compatible during development:
            // We assume the backend succeeded.
            setSignupStep('code');

        } catch (backendError: any) {
             console.warn("Backend function failed or not deployed. Falling back to DEMO MODE.", backendError);
             
             // --- FALLBACK: CLIENT-SIDE MOCK ---
            const code = generateCode();
            setGeneratedCode(code);
            await new Promise(r => setTimeout(r, 1000)); // Simulate delay
            alert(`DEMO MODE (Backend Unavailable): Your verification code is ${code}\n\n(Deploy functions/index.js to Firebase to enable real emails)`);
            setSignupStep('code');
        }

    } catch (err: any) {
        console.error("Verification error:", err);
        setError("Failed to process request. Please try again.");
    } finally {
        setIsLoading(false);
    }
  };

  // --- Step 2: Verify Code ---
  const handleVerifyCode = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      // --- ATTEMPT REAL CLOUD FUNCTION VERIFICATION ---
      // If we are in "Real Mode", we should call a verify function.
      // If we are in "Demo Mode", we check local state.
      
      try {
        if (generatedCode) {
            // DEMO MODE CHECK
            if (codeInput === generatedCode) {
                setSignupStep('details');
            } else {
                setError("Incorrect verification code. Please check your email and try again.");
            }
        } else {
            // BACKEND MODE CHECK
            // If we didn't generate a code locally, it means the backend did.
            try {
                const verifyVerificationCode = httpsCallable(functions, 'verifyVerificationCode');
                const result = await verifyVerificationCode({ email, code: codeInput });
                
                if ((result.data as any).valid) {
                     setSignupStep('details');
                } else {
                    setError("Invalid code. Please try again.");
                }
            } catch (err) {
                console.error("Verification failed", err);
                setError("Failed to verify code with server.");
            }
        }
      } finally {
          setIsLoading(false);
      }
  };

  // --- Step 3: Create Account ---
  const handleSignup = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!firstName.trim() || !lastName.trim() || !displayName.trim()) {
          setError('All fields are required.');
          return;
      }
      if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
      }

      setIsLoading(true);
      try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          try {
              await createUserProfileDocument(user, { displayName, firstName, lastName });
              // Success handled by Auth Listener in App.tsx
          } catch (profileError) {
              console.error("Profile creation failed:", profileError);
              if (auth.currentUser) await deleteUser(auth.currentUser);
              throw new Error("Failed to create user profile.");
          }
      } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') {
            setError('This email is already in use.');
          } else {
            setError('Failed to sign up. Please try again.');
          }
          console.error(error);
          setIsLoading(false);
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);
      try {
          await signInWithEmailAndPassword(auth, email, password);
      } catch (error: any) {
          setError('Invalid email or password. Please try again.');
          setIsLoading(false);
      }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (resetAttempts >= 3) return setError("Too many attempts. Please wait.");
      if (!email) return setError("Please enter your email address.");

      setIsLoading(true);
      setError(null);
      setResetMessage(null);
      
      try {
          const signInMethods = await fetchSignInMethodsForEmail(auth, email);
          if (signInMethods.length === 0) {
              setError("No account found with this email.");
              setIsLoading(false);
              return;
          }
          await sendPasswordResetEmail(auth, email);
          setResetMessage("Password reset email sent! Check your inbox.");
      } catch (err: any) {
          setError(err.code === 'auth/user-not-found' ? "No account found." : "Failed to send reset email.");
      } finally {
          setResetAttempts(prev => prev + 1);
          setIsLoading(false);
      }
  };
  
  // Render Helpers
  const renderSignupStep = () => {
      switch(signupStep) {
          case 'email':
              return (
                  <form onSubmit={handleSendCode} className="space-y-4">
                      <div>
                        <label className="text-sm font-bold text-ghost-white" htmlFor="signup-email">Email Address</label>
                        <input 
                          type="email" 
                          id="signup-email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(null); }}
                          placeholder="principal@example.com"
                          required
                          className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-primary-red/20 disabled:bg-accent-gray disabled:cursor-wait"
                      >
                        {isLoading ? 'Checking...' : 'Send Verification Code'}
                      </button>
                  </form>
              );
          case 'code':
               return (
                  <form onSubmit={handleVerifyCode} className="space-y-4">
                      <div className="text-center mb-4">
                          <p className="text-highlight-silver text-sm">We sent a 6-digit code to</p>
                          <p className="text-pure-white font-bold">{email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-ghost-white" htmlFor="code">Verification Code</label>
                        <input 
                          type="text" 
                          id="code"
                          value={codeInput}
                          onChange={(e) => { setCodeInput(e.target.value); setError(null); }}
                          placeholder="123456"
                          required
                          maxLength={6}
                          className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white text-center text-2xl tracking-widest focus:outline-none focus:ring-primary-red focus:border-primary-red"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-primary-red/20"
                      >
                        {isLoading ? 'Verifying...' : 'Verify Code'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignupStep('email')}
                        className="w-full text-sm text-highlight-silver hover:text-pure-white mt-2"
                      >
                        Change Email
                      </button>
                  </form>
               );
          case 'details':
               return (
                  <form onSubmit={handleSignup} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-ghost-white">First Name</label>
                                <input 
                                    type="text" 
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="John"
                                    required
                                    className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-ghost-white">Last Name</label>
                                <input 
                                    type="text" 
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Doe"
                                    required
                                    className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-ghost-white">Display Name</label>
                            <input 
                                type="text" 
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Team Name"
                                required
                                className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-ghost-white">Password</label>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-ghost-white">Confirm Password</label>
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-primary-red/20 disabled:bg-accent-gray disabled:cursor-wait"
                        >
                            {isLoading ? 'Creating Account...' : 'Complete Registration'}
                        </button>
                  </form>
               );
      }
  };

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="bg-accent-gray/50 backdrop-blur-sm rounded-xl p-8 ring-1 ring-pure-white/10">
        <div 
          className="flex flex-col items-center mb-6 cursor-pointer"
          onClick={handleLogoClick}
        >
          <F1FantasyLogo className="w-64 h-auto mb-4"/>
          {isResetting && <h2 className="text-xl font-bold text-pure-white">Reset Password</h2>}
          {!isResetting && !isLogin && (
              <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${signupStep === 'email' ? 'bg-primary-red' : 'bg-highlight-silver'}`}></span>
                  <span className={`w-2 h-2 rounded-full ${signupStep === 'code' ? 'bg-primary-red' : 'bg-highlight-silver'}`}></span>
                  <span className={`w-2 h-2 rounded-full ${signupStep === 'details' ? 'bg-primary-red' : 'bg-highlight-silver'}`}></span>
              </div>
          )}
        </div>
        
        {/* Render Form Content */}
        {isResetting ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                    <label className="text-sm font-bold text-ghost-white">Email Address</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(null); setResetMessage(null); }}
                        required
                        className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-primary-red/20 disabled:bg-accent-gray disabled:cursor-wait"
                >
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
            </form>
        ) : isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="text-sm font-bold text-ghost-white">Email Address</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(null); }}
                        required
                        className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red"
                    />
                </div>
                <div>
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-ghost-white">Password</label>
                        <button type="button" onClick={() => { resetFlows(); setIsResetting(true); }} className="text-xs text-highlight-silver hover:text-primary-red">
                            Forgot Password?
                        </button>
                    </div>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(null); }}
                        required
                        className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-primary-red/20 disabled:bg-accent-gray disabled:cursor-wait"
                >
                    {isLoading ? 'Logging In...' : 'Log In'}
                </button>
            </form>
        ) : (
            // Sign Up Logic
            renderSignupStep()
        )}

        {error && <p className="text-sm text-primary-red text-center pt-4 font-semibold">{error}</p>}
        {resetMessage && <p className="text-sm text-green-500 text-center pt-4 font-bold">{resetMessage}</p>}

        <div className="mt-6 text-center space-y-2 border-t border-pure-white/5 pt-4">
            {!isResetting ? (
                <button onClick={() => { setIsLogin(!isLogin); resetFlows(); }} className="text-sm text-highlight-silver hover:text-primary-red transition-colors">
                    {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
                </button>
            ) : (
                <button 
                    onClick={() => { resetFlows(); setIsLogin(true); }} 
                    className="text-sm text-highlight-silver hover:text-pure-white transition-colors flex items-center justify-center gap-2 w-full"
                >
                    &larr; Back to Log In
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
