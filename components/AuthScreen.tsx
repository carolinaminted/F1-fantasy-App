
import React, { useState, useEffect } from 'react';
import { F1FantasyLogo } from './icons/F1FantasyLogo.tsx';
import { auth, functions } from '../services/firebase.ts';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser, sendPasswordResetEmail, fetchSignInMethodsForEmail } from '@firebase/auth';
import { httpsCallable } from '@firebase/functions';
import { createUserProfileDocument } from '../services/firestoreService.ts';
import { validateDisplayName, validateRealName, sanitizeString } from '../services/validation.ts';
// @ts-ignore
import confetti from 'canvas-confetti';

const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  
  // Signup Flow State
  // New Step: 'invitation' must happen before 'email'
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

  // Check Local Storage for Blocked State on Mount
  useEffect(() => {
      const storedAttempts = localStorage.getItem('invitation_attempts');
      const storedBlock = localStorage.getItem('invitation_block_until');
      
      if (storedAttempts) setFailedAttempts(parseInt(storedAttempts));
      if (storedBlock) {
          const blockTime = parseInt(storedBlock);
          if (Date.now() < blockTime) {
              setBlockUntil(blockTime);
          } else {
              // Block expired, reset
              localStorage.removeItem('invitation_attempts');
              localStorage.removeItem('invitation_block_until');
              setFailedAttempts(0);
          }
      }
  }, []);

  // Timer for Countdown
  useEffect(() => {
      let interval: any;
      if (blockUntil > 0) {
          interval = setInterval(() => {
              const remaining = Math.ceil((blockUntil - Date.now()) / 1000);
              if (remaining <= 0) {
                  setBlockUntil(0);
                  setFailedAttempts(0);
                  localStorage.removeItem('invitation_attempts');
                  localStorage.removeItem('invitation_block_until');
                  clearInterval(interval);
              } else {
                  setTimeLeftBlocked(remaining);
              }
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [blockUntil]);

  const resetFlows = () => {
      setError(null);
      setResetMessage(null);
      setIsResetting(false);
      // Reset to invitation step if switching to signup, unless we are blocked
      setSignupStep('invitation');
      setCodeInput('');
      setResetAttempts(0);
      setPassword('');
      setConfirmPassword('');
  };

  const handleLogoClick = async () => {
    // Checkered Flag Confetti Celebration
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#ffffff', '#000000', '#1a1a1a', '#cccccc'],
      disableForReducedMotion: true,
      zIndex: 2000
    });

    // Secret Auto-fill for Demo/Testing (Only works on Details step)
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

  // --- Step 0: Validate Invitation Code ---
  const handleValidateInvitation = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (blockUntil > Date.now()) return;

      setIsLoading(true);
      try {
          const validateFn = httpsCallable(functions, 'validateInvitationCode');
          // Trim and uppercase code for consistency
          const codeToSubmit = invitationCode.trim().toUpperCase();
          const result = await validateFn({ code: codeToSubmit });
          const data = result.data as any;

          if (data.valid) {
              setInvitationCode(codeToSubmit); // Normalize
              setSignupStep('email');
              // Clear attempts on success
              localStorage.removeItem('invitation_attempts');
              setFailedAttempts(0);
          } else {
              // Should catch block below, but just in case
              throw new Error("Invalid Code");
          }

      } catch (err: any) {
          console.error("Invitation validation failed:", err);
          const newAttempts = failedAttempts + 1;
          setFailedAttempts(newAttempts);
          localStorage.setItem('invitation_attempts', newAttempts.toString());

          if (newAttempts >= 3) {
              const blockTime = Date.now() + 10 * 60 * 1000; // 10 minutes
              setBlockUntil(blockTime);
              localStorage.setItem('invitation_block_until', blockTime.toString());
              setError("Maximum attempts reached. Please try again in 10 minutes.");
          } else {
              setError(err.message || "Invalid or used invitation code.");
          }
      } finally {
          setIsLoading(false);
      }
  };

  // --- Step 1: Send Verification Code ---
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

        console.log("Calling Cloud Function: sendAuthCode");
        
        const sendAuthCode = httpsCallable(functions, 'sendAuthCode');
        await sendAuthCode({ email });
        
        setSignupStep('code');

    } catch (err: any) {
        console.error("Verification error:", err);
        if (err.message) {
             setError(err.message);
        } else {
             setError("Failed to process request. Please check your connection.");
        }
    } finally {
        setIsLoading(false);
    }
  };

  // --- Step 2: Verify Code ---
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

  // --- Step 3: Create Account ---
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
              // PASS INVITATION CODE HERE to be saved and marked used
              await createUserProfileDocument(user, { 
                  displayName: cleanDisplayName, 
                  firstName: cleanFirstName, 
                  lastName: cleanLastName,
                  invitationCode: invitationCode // Passed from state
              });
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
                              placeholder="FF1-XXXX-XXXX"
                              required
                              className="block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-3 px-4 text-pure-white text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-primary-red focus:border-primary-red uppercase"
                            />
                            {failedAttempts > 0 && failedAttempts < 3 && (
                                <p className="text-xs text-yellow-500 mt-2 text-center">
                                    {3 - failedAttempts} attempts remaining.
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
