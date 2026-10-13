import { useEffect, useRef, useCallback, useState } from 'react';
import { User } from '../types.ts';
import { auth } from '../services/firebase.ts';
import { signOut } from '@firebase/auth';
import { SESSION_STORAGE_KEY } from '../constants.ts';

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_THRESHOLD = 10 * 60 * 1000; // 10 minutes (Warning triggers 5 mins before timeout)

export const useSessionGuard = (user: User | null, onExpired: () => void) => {
    // Track last activity in a Ref so it persists across re-renders
    const lastActivity = useRef(Date.now());
    // On resume the visibility check and the interval both fire; only one sign-out should run.
    const loggingOut = useRef(false);
    const [showWarning, setShowWarning] = useState(false);
    const [idleExpiryTime, setIdleExpiryTime] = useState(0);
    
    // Forced Logout Function
    const forceLogout = useCallback(async (reason: string) => {
        if (loggingOut.current) return;
        loggingOut.current = true;
        try {
            console.log(`Session Guard Logout Triggered: ${reason}`);
            setShowWarning(false);
            await signOut(auth);
            // Everything below waits for signOut to land. This used to set an "expired" flag and
            // clear the activity key first, then hard-reload: whenever signOut threw or the resumed
            // page died mid-way, the next load announced a logout over a session that was still
            // valid, and with a freshly reset idle clock. App's auth listener resets all state on
            // sign-out, so no reload is needed.
            localStorage.removeItem(SESSION_STORAGE_KEY);
            onExpired();
        } catch (error) {
            // Still signed in; the interval retries on its next tick.
            console.error("Session guard logout error:", error);
        } finally {
            loggingOut.current = false;
        }
    }, [onExpired]);

    // Manual Logout (Exposed to UI)
    const logout = useCallback(async () => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        await signOut(auth);
    }, []);

    // Continue Session Function (User Interaction from Modal)
    const continueSession = useCallback(() => {
        const now = Date.now();
        lastActivity.current = now;
        localStorage.setItem(SESSION_STORAGE_KEY, now.toString());
        setShowWarning(false);
    }, []);

    // 1. Initialization and Activity Listeners
    useEffect(() => {
        if (!user) return;

        // CHECK 1: Immediate Expiry Check on Mount
        // If the browser was closed for a week, this check catches the stale session immediately.
        const storedActivity = localStorage.getItem(SESSION_STORAGE_KEY);
        if (storedActivity) {
            const lastActiveTime = parseInt(storedActivity, 10);
            const elapsed = Date.now() - lastActiveTime;
            
            if (elapsed > IDLE_TIMEOUT) {
                lastActivity.current = lastActiveTime;
                forceLogout("Session expired across reload/restart.");
                return; // Stop setting up listeners
            }
            // Sync ref with stored time
            lastActivity.current = lastActiveTime;
        } else {
            // New session or cleaned storage, mark now. The ref too: with no reload after a
            // timeout sign-out, it still holds the expired session's time.
            const now = Date.now();
            lastActivity.current = now;
            localStorage.setItem(SESSION_STORAGE_KEY, now.toString());
        }

        // If warning is active, we STOP listening to passive events.
        if (showWarning) return;

        const updateActivity = () => {
            const now = Date.now();
            // Throttle updates to once per second
            if (now - lastActivity.current > 1000) {
                lastActivity.current = now;
                // PERSIST: Save to storage so it survives refresh/close
                localStorage.setItem(SESSION_STORAGE_KEY, now.toString());
            }
        };

        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'mousemove'];
        events.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));

        return () => {
            events.forEach(evt => window.removeEventListener(evt, updateActivity));
        };
    }, [user, showWarning, forceLogout]);

    // 2. Resume Detect (Visibility Change)
    // Mobile browsers suspend JS intervals when in background. 
    // This effect ensures we check session validity immediately when the user returns.
    useEffect(() => {
        if (!user) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                
                // Re-read storage in case another tab updated it (though we primarily care about this tab's logic)
                const stored = localStorage.getItem(SESSION_STORAGE_KEY);
                const referenceTime = stored ? parseInt(stored, 10) : lastActivity.current;
                
                const timeSinceLastActivity = now - referenceTime;
                
                if (timeSinceLastActivity > IDLE_TIMEOUT) {
                    forceLogout("Session expired during sleep.");
                } else if (timeSinceLastActivity > WARNING_THRESHOLD) {
                    setIdleExpiryTime(referenceTime + IDLE_TIMEOUT);
                    setShowWarning(true);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [user, forceLogout]);

    // 3. Active Timer Interval Effect
    useEffect(() => {
        if (!user) return;

        const checkInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivity.current;
            
            // Check Idle Time
            if (timeSinceLastActivity > IDLE_TIMEOUT) {
                forceLogout("Inactivity limit reached.");
                return;
            }

            // Check Warning Threshold
            if (timeSinceLastActivity > WARNING_THRESHOLD && !showWarning) {
                setIdleExpiryTime(lastActivity.current + IDLE_TIMEOUT);
                setShowWarning(true);
            }
        }, 1000); // Check every second

        return () => {
            clearInterval(checkInterval);
        };
    }, [user, showWarning, forceLogout]);

    return { 
        showWarning, 
        idleExpiryTime, 
        continueSession,
        logout 
    };
};