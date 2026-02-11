import React, { useState } from 'react';
import { F1FantasyLogo } from './icons/F1FantasyLogo.tsx';
import { auth, functions } from '../services/firebase.ts';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser, fetchSignInMethodsForEmail } from '@firebase/auth';
import { httpsCallable } from '@firebase/functions';
import { createUserProfileDocument } from '../services/firestoreService.ts';
import { validateDisplayName, validateRealName, sanitizeString } from '../services/validation.ts';
import { SESSION_STORAGE_KEY } from '../constants.ts';
import { useRaceStartEasterEgg, EasterEggOverlay } from './EasterEgg.tsx';
import { EyeIcon } from './icons/EyeIcon.tsx';
import { EyeOffIcon } from './icons/EyeOffIcon.tsx';

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
  const [resetCooldownTime, setResetCooldownTime] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  // Easter Egg Hook
  const { easterEggState, activeLights, handleTriggerClick } = useRaceStartEasterEgg();

  // Timer for Countdown (UX Only - Server enforces actual block)
  React.useEffect(() => {
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

  // Timer for Reset Password Cooldown
  React.useEffect(() => {
      let interval: any;
      if (resetCooldownTime > 0) {
          interval = setInterval(() => {
              setResetCooldownTime(prev => Math.max(0, prev - 1));
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [resetCooldownTime]);

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

  const handleLogoClick = () => {
    setError(null);
    setResetMessage(null);
    handleTriggerClick();
  };

  const handleInvitationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);

      // 1. Strip everything except alphanumeric characters
      const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

      // 2. Cap at 11 raw characters (3 + 4 + 4)
      const capped = raw.slice(0, 11);

      // 3. Insert dashes at correct positions: XXX-XXXX-XXXX
      let formatted = capped;
      if (capped.length > 3) {
          formatted = capped.slice(0, 3) + '-' + capped.slice(3);
      }
      if (capped.length > 7) {
          formatted = capped.slice(0, 3) + '-' + capped.slice(3, 7) + '-' + capped.slice(7);
      }

      setInvitationCode(formatted);
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
          
          // Force token refresh so Firestore security rules see the new auth identity immediately.
          // Without this, isOwner(userId) checks can fail due to token propagation delay.
          await user.getIdToken(true);
          
          try {
              await createUserProfileDocument(user, { 
                  displayName: cleanDisplayName, 
                  firstName: cleanFirstName, 
                  lastName: cleanLastName,
                  invitationCode: invitationCode
              });
              
              // Prime the session guard so we don't immediately expire the fresh session
              localStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());

          } catch (profileError) {
              console.error("Profile creation failed:", profileError);
              // Use the user ref from userCredential, NOT auth.currentUser (which can be stale)
              try {
                  await deleteUser(user);
              } catch (rollbackError) {
                  console.error("CRITICAL: Failed to rollback orphaned auth user:", user.uid, rollbackError);
              }
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
      if (resetAttempts >= 3) return setError("Maximum attempts reached. Please try again later.");
      if (resetCooldownTime > 0) return; // Block if cooldown active
      if (!email) return setError("Please enter your email address.");

      setIsLoading(true);
      setError(null);
      setResetMessage(null);
      
      try {
          const sendResetLink = httpsCallable(functions, 'sendPasswordResetLink');
          await sendResetLink({ email });
      } catch (err: any) {
          // Rate limit error from server
          if (err.code === 'functions/resource-exhausted') {
              setError("Too many attempts. Please wait a few minutes.");
              setIsLoading(false);
              return;
          }
          console.error("Password reset error:", err);
      }
      
      // Always show generic success to prevent email enumeration
      setResetMessage("If an account exists with this email, a password reset link has been sent. Check your inbox and spam folder.");
      setResetAttempts(prev => prev + 1);
      setResetCooldownTime(60); // Start 60s cooldown
      setIsLoading(false);
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
                              onChange={handleInvitationCodeChange}
                              placeholder="LOL-XXXX-XXXX"
                              maxLength={13}
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
                            <div className="relative mt-1">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-highlight-silver hover:text-pure-white rounded-r-md focus:outline-none"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-ghost-white">Confirm Password</label>
                            <div className="relative mt-1">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-highlight-silver hover:text-pure-white rounded-r-md focus:outline-none"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                </button>
                            </div>
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
      <EasterEggOverlay state={easterEggState} activeLights={activeLights} />

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
                    disabled={isLoading || resetCooldownTime > 0}
                    className="w-full bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-primary-red/20 disabled:bg-accent-gray disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Sending...' : resetCooldownTime > 0 ? `Resend in ${resetCooldownTime}s` : 'Send Reset Link'}
                </button>
                {resetAttempts > 0 && resetAttempts < 3 && (
                    <p className="text-xs text-highlight-silver text-center">Attempts remaining: {3 - resetAttempts}</p>
                )}
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
                    <div className="relative mt-1">
                        <input 
                            id="login-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(null); }}
                            required
                            className="block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-highlight-silver hover:text-pure-white rounded-r-md focus:outline-none"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                        </button>
                    </div>
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