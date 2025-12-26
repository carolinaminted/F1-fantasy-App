import { useEffect, useRef, useCallback, useState } from 'react';
import { User } from '../types.ts';
import { auth } from '../services/firebase.ts';
import { signOut } from '@firebase/auth';

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

    // Continue Session Function (User Interaction from Modal)
    const continueSession = useCallback(() => {
        lastActivity.current = Date.now();
        setShowWarning(false);
    }, []);

    // 1. Activity Listeners Effect
    useEffect(() => {
        if (!user) return;

        // If warning is active, we STOP listening to passive events.
        // The user must explicitly click "Continue" in the modal.
        if (showWarning) return;

        lastActivity.current = Date.now();

        const updateActivity = () => {
            const now = Date.now();
            // Throttle updates to once per second
            if (now - lastActivity.current > 1000) {
                lastActivity.current = now;
            }
        };

        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'mousemove'];
        events.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));

        return () => {
            events.forEach(evt => window.removeEventListener(evt, updateActivity));
        };
    }, [user, showWarning]);

    // 2. Resume Detect (Visibility Change)
    // Mobile browsers suspend JS intervals when in background. 
    // This effect ensures we check session validity immediately when the user returns.
    useEffect(() => {
        if (!user) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                const timeSinceLastActivity = now - lastActivity.current;
                
                if (timeSinceLastActivity > IDLE_TIMEOUT) {
                    forceLogout("Session expired during sleep.");
                } else if (timeSinceLastActivity > WARNING_THRESHOLD) {
                    setIdleExpiryTime(lastActivity.current + IDLE_TIMEOUT);
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
        logout: () => signOut(auth) 
    };
};