
import React, { useState, useEffect, useRef } from 'react';
import { F1FantasyLogo } from './icons/F1FantasyLogo.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { auth, functions } from '../services/firebase.ts';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser, sendPasswordResetEmail, fetchSignInMethodsForEmail } from '@firebase/auth';
import { httpsCallable } from '@firebase/functions';
import { createUserProfileDocument } from '../services/firestoreService.ts';
import { validateDisplayName, validateRealName, sanitizeString } from '../services/validation.ts';
import { SESSION_STORAGE_KEY } from '../constants.ts';

const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  
  // Signup Flow State
  const [signupStep, setSignupStep] = useState<'invitation' | 'email' | 'code' | 'details'>('invitation');
  
  // Invitation Code State
  const [invitationCode, setInvitationCode] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockUntil, setBlockUntil] = useState<number>(0);
  const [timeLeftBlocked, setTimeLeftBlocked] = useState(0);

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

  // Easter Egg State: Race Start Sequence
  const [easterEggState, setEasterEggState] = useState<'idle' | 'lights' | 'racing' | 'finished'>('idle');
  const [activeLights, setActiveLights] = useState(0);
  
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer for Countdown (UX Only - Server enforces actual block)
  useEffect(() => {
      let interval: any;
      if (blockUntil > Date.now()) {
          interval = setInterval(() => {
              const remaining = Math.ceil((blockUntil - Date.now()) / 1000);
              if (remaining <= 0) {
                  setBlockUntil(0);
                  setFailedAttempts(0);
                  clearInterval(interval);
              } else {
                  setTimeLeftBlocked(remaining);
              }
          }, 1000);
      } else if (blockUntil > 0 && blockUntil <= Date.now()) {
          setBlockUntil(0);
      }
      return () => clearInterval(interval);
  }, [blockUntil]);

  const resetFlows = () => {
      setError(null);
      setResetMessage(null);
      setIsResetting(false);
      setSignupStep('invitation');
      setCodeInput('');
      setResetAttempts(0);
      setPassword('');
      setConfirmPassword('');
  };

  const triggerRaceSequence = () => {
      setEasterEggState('lights');
      setActiveLights(0);
      
      // Start the 5 red lights sequence
      let currentLight = 0;
      const interval = setInterval(() => {
          currentLight++;
          setActiveLights(currentLight);
          
          if (currentLight >= 5) {
              clearInterval(interval);
              
              // Random hold time before lights out (between 0.2s and 2s is realistic for F1)
              const holdTime = 200 + Math.random() * 1800;
              
              setTimeout(() => {
                  setEasterEggState('racing'); // Lights Out!
                  
                  // Trigger Confetti
                  import('canvas-confetti').then(module => {
                      const confetti = module.default;
                      // Initial Burst
                      confetti({
                          particleCount: 150,
                          spread: 100,
                          origin: { y: 0.6 },
                          colors: ['#DA291C', '#FFFFFF', '#000000'],
                          zIndex: 10000
                      });
                      
                      // Follow up side cannons
                      setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, zIndex: 10000 }), 300);
                      setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, zIndex: 10000 }), 300);
                  });

                  // Reset after race animation completes
                  setTimeout(() => {
                      setEasterEggState('finished');
                      setTimeout(() => setEasterEggState('idle'), 500);
                  }, 2500);
              }, holdTime);
          }
      }, 800); // 0.8s between each red light turning on
  };

  const handleLogoClick = async () => {
    setError(null);
    setResetMessage(null);

    // Easter Egg Logic: 5 clicks in 2 seconds
    clickCountRef.current += 1;
    
    // Start timer on first click
    if (clickCountRef.current === 1) {
        clickTimerRef.current = setTimeout(() => {
            clickCountRef.current = 0; // Reset
        }, 2000);
    }

    if (clickCountRef.current >= 5) {
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        clickCountRef.current = 0;
        triggerRaceSequence();
    }
  };

  const handleValidateInvitation = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (blockUntil > Date.now()) return;

      setIsLoading(true);
      try {
          const validateFn = httpsCallable(functions, 'validateInvitationCode');
          const codeToSubmit = invitationCode.trim().toUpperCase();
          const result = await validateFn({ code: codeToSubmit });
          const data = result.data as any;

          if (data.valid) {
              setInvitationCode(codeToSubmit);
              setSignupStep('email');
              setFailedAttempts(0);
          } else {
              throw new Error("Invalid Code");
          }

      } catch (err: any) {
          console.error("Invitation validation failed:", err);
          if (err.code === 'resource-exhausted' || (err.message && err.message.includes('Too many attempts'))) {
              const blockTime = Date.now() + 10 * 60 * 1000;
              setBlockUntil(blockTime);
              setError("Maximum attempts reached. Please try again in 10 minutes.");
          } else {
              setFailedAttempts(prev => prev + 1);
              setError(err.message || "Invalid or used invitation code.");
          }
      } finally {
          setIsLoading(false);
      }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Please enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Please enter a valid email address.");

    setIsLoading(true);
    try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length > 0) {
            setIsLoading(false);
            return setError("An account with this email already exists. Please log in.");
        }

        const sendAuthCode = httpsCallable(functions, 'sendAuthCode');
        await sendAuthCode({ email });
        
        setSignupStep('code');

    } catch (err: any) {
        console.error("Verification error:", err);
        if (err.code === 'resource-exhausted') {
             setError("Too many requests. Please wait a moment before trying again.");
        } else if (err.message) {
             setError(err.message);
        } else {
             setError("Failed to process request. Please check your connection.");
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      try {
        try {
            const verifyAuthCode = httpsCallable(functions, 'verifyAuthCode');
            const result = await verifyAuthCode({ email, code: codeInput });
            const data = result.data as any;
            
            if (data.valid) {
                 setSignupStep('details');
            } else {
                setError(data.message || "Invalid code. Please try again.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to verify code with server. Please try again.");
        }
      } finally {
          setIsLoading(false);
      }
  };

  const handleSignup = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const fnValidation = validateRealName(firstName, "First Name");
      if (!fnValidation.valid) return setError(fnValidation.error || "Invalid first name.");

      const lnValidation = validateRealName(lastName, "Last Name");
      if (!lnValidation.valid) return setError(lnValidation.error || "Invalid last name.");

      const dnValidation = validateDisplayName(displayName);
      if (!dnValidation.valid) return setError(dnValidation.error || "Invalid display name.");

      if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
      }

      const cleanFirstName = sanitizeString(firstName);
      const cleanLastName = sanitizeString(lastName);
      const cleanDisplayName = sanitizeString(displayName);

      setIsLoading(true);
      try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          try {
              await createUserProfileDocument(user, { 
                  displayName: cleanDisplayName, 
                  firstName: cleanFirstName, 
                  lastName: cleanLastName,
                  invitationCode: invitationCode
              });
              localStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());

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
          localStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
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
  
  const renderSignupStep = () => {
      switch(signupStep) {
          case 'invitation':
              const isBlocked = blockUntil > Date.now();
              const mins = Math.floor(timeLeftBlocked / 60);
              const secs = timeLeftBlocked % 60;

              return (
                  <form onSubmit={handleValidateInvitation} className="space-y-4">
                      <div className="text-center mb-4">
                          <h3 className="text-lg font-bold text-pure-white mb-2">Registration Code</h3>
                          <p className="text-xs text-highlight-silver">Enter your exclusive invitation code to begin.</p>
                      </div>
                      
                      {isBlocked ? (
                          <div className="bg-red-900/30 border border-primary-red/50 rounded-lg p-4 text-center animate-pulse">
                              <p className="text-primary-red font-bold uppercase text-xs mb-1">Access Blocked</p>
                              <p className="text-pure-white font-mono text-xl">
                                  {mins}:{secs.toString().padStart(2, '0')}
                              </p>
                              <p className="text-xs text-highlight-silver mt-1">Too many failed attempts.</p>
                          </div>
                      ) : (
                          <div>
                            <input 
                              type="text" 
                              value={invitationCode}
                              onChange={(e) => { setInvitationCode(e.target.value); setError(null); }}
                              placeholder="LOL-XXXX-XXXX"
                              required
                              className="block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-3 px-4 text-pure-white text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-primary-red focus:border-primary-red uppercase"
                            />
                            {failedAttempts > 0 && failedAttempts < 5 && (
                                <p className="text-xs text-yellow-500 mt-2 text-center">
                                    Incorrect code. Please try again.
                                </p>
                            )}
                          </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading || isBlocked || !invitationCode.trim()}
                        className="w-full bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-primary-red/20 disabled:bg-accent-gray disabled:cursor-not-allowed"
                      >
                        {isLoading ? 'Validating...' : 'Validate Code'}
                      </button>
                  </form>
              );

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
                                    maxLength={50}
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
                                    maxLength={50}
                                    className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-ghost-white">Display Name (Max 20)</label>
                            <input 
                                type="text" 
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Team Name"
                                required
                                maxLength={20}
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
    <div className="max-w-md mx-auto w-full relative">
      {/* Race Start Easter Egg Overlay */}
      {easterEggState !== 'idle' && (
          <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center overflow-hidden">
              <style>
                  {`
                    @keyframes raceBy {
                        0% { transform: translateX(-120vw); opacity: 0; }
                        10% { opacity: 1; }
                        100% { transform: translateX(120vw); opacity: 1; }
                    }
                    .animate-race-car {
                        animation: raceBy 1.5s cubic-bezier(0.1, 0.7, 1.0, 0.1) forwards;
                    }
                    .animate-race-car-delayed {
                        animation: raceBy 1.6s cubic-bezier(0.1, 0.7, 1.0, 0.1) forwards;
                        animation-delay: 0.1s;
                    }
                  `}
              </style>

              {/* Start Lights */}
              <div className={`transition-opacity duration-100 mb-20 ${easterEggState === 'racing' ? 'opacity-0' : 'opacity-100'}`}>
                   <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-3xl border-4 border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex gap-4 md:gap-6">
                       {[1, 2, 3, 4, 5].map(i => (
                           <div 
                              key={i} 
                              className={`w-12 h-12 md:w-20 md:h-20 rounded-full border-4 border-gray-700 shadow-inner transition-all duration-75 ${
                                  activeLights >= i 
                                  ? 'bg-[#FF0000] shadow-[0_0_40px_#FF0000] scale-105 border-red-900' 
                                  : 'bg-[#0f0f0f] opacity-50'
                              }`} 
                           />
                       ))}
                   </div>
              </div>
              
              {/* Racing Action */}
              {easterEggState === 'racing' && (
                  <div className="absolute inset-0 w-full h-full pointer-events-none flex items-center justify-center">
                      {/* Track Blur */}
                      <div className="absolute w-full h-40 bg-gray-800/20 blur-xl"></div>
                      
                      {/* Lights Out Text */}
                      <div className="absolute top-1/4 animate-ping text-5xl md:text-8xl font-black text-white italic uppercase tracking-tighter opacity-80">
                          LIGHTS OUT!
                      </div>

                      {/* Cars */}
                      <div className="relative w-full h-full">
                          {/* Car 1: Red Bull / Max Style */}
                          <div className="absolute top-[45%] left-0 animate-race-car">
                              <F1CarIcon className="w-48 h-48 md:w-80 md:h-80 text-primary-red rotate-90 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" />
                              <div className="absolute top-1/2 left-0 w-full h-2 bg-white/10 blur-xl"></div>
                          </div>

                          {/* Car 2: McLaren / Lando Style */}
                          <div className="absolute top-[55%] left-0 animate-race-car-delayed">
                              <F1CarIcon className="w-48 h-48 md:w-80 md:h-80 text-yellow-500 rotate-90 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" />
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      <div className="bg-carbon-fiber rounded-xl p-8 border border-pure-white/10 shadow-2xl relative z-10">
        <div 
          className="flex flex-col items-center mb-6 cursor-pointer select-none active:scale-95 transition-transform"
          onClick={handleLogoClick}
        >
          <F1FantasyLogo className="w-64 h-auto mb-4"/>
          {isResetting && <h2 className="text-xl font-bold text-pure-white">Reset Password</h2>}
          {!isResetting && !isLogin && (
              <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${signupStep === 'invitation' ? 'bg-primary-red' : 'bg-highlight-silver'}`}></span>
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
                    <label className="text-sm font-bold text-ghost-white" htmlFor="login-email">Email Address</label>
                    <input 
                        id="login-email"
                        type="email" 
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(null); }}
                        required
                        className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red"
                    />
                </div>
                <div>
                    <label className="text-sm font-bold text-ghost-white" htmlFor="login-password">Password</label>
                    <input 
                        id="login-password"
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
                <div className="text-center">
                    <button type="button" onClick={() => { resetFlows(); setIsResetting(true); }} className="text-xs text-highlight-silver hover:text-primary-red">
                        Forgot Password?
                    </button>
                </div>
            </form>
        ) : (
            // Sign Up Logic
            renderSignupStep()
        )}

        {error && <p className="text-sm text-yellow-500 text-center pt-4 font-semibold animate-pulse">{error}</p>}
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
