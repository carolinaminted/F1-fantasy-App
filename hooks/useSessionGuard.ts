import { useEffect, useRef, useCallback, useState } from 'react';
import { User } from '../types.ts';
import { auth } from '../services/firebase.ts';
import { signOut } from '@firebase/auth';
import { SESSION_STORAGE_KEY } from '../constants.ts';

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_THRESHOLD = 10 * 60 * 1000; // 10 minutes (Warning triggers 5 mins before timeout)

export const useSessionGuard = (user: User | null) => {
    // Track last activity in a Ref so it persists across re-renders
    const lastActivity = useRef(Date.now());
    const [showWarning, setShowWarning] = useState(false);
    const [idleExpiryTime, setIdleExpiryTime] = useState(0);
    
    // Forced Logout Function
    const forceLogout = useCallback(async (reason: string) => {
        try {
            console.log(`Session Guard Logout Triggered: ${reason}`);
            setShowWarning(false); 
            
            // Clear the persistence key so the next session is clean
            localStorage.removeItem(SESSION_STORAGE_KEY);

            // Set a flag in localStorage so App.tsx can show a friendly toast after reload
            localStorage.setItem('ff1_session_expired', 'true');
            
            // Sign out from Firebase
            await signOut(auth);
            
            // CRITICAL: We use location.replace to force a clean browser state.
            // We avoid alert() because it is synchronous and can cause browser hangs on mobile resume.
            window.location.replace(window.location.origin);
        } catch (error) {
            console.error("Session guard logout error:", error);
            // Absolute fallback if everything fails: force reload
            window.location.reload();
        }
    }, []);

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
                forceLogout("Session expired across reload/restart.");
                return; // Stop setting up listeners
            }
            // Sync ref with stored time
            lastActivity.current = lastActiveTime;
        } else {
            // New session or cleaned storage, mark now
            localStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
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
                clearInterval(checkInterval);
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