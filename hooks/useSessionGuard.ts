
import { useEffect, useRef, useCallback } from 'react';
import { User } from '../types.ts';
import { auth } from '../services/firebase.ts';
import { signOut } from '@firebase/auth';

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const MAX_SESSION_TIME = 4 * 60 * 60 * 1000; // 4 hours

export const useSessionGuard = (user: User | null) => {
    // Track last activity in a Ref so it persists across re-renders but resets on mount (page load)
    const lastActivity = useRef(Date.now());
    
    const logout = useCallback(async (reason: string) => {
        try {
            console.log(`Session Guard Logout Triggered: ${reason}`);
            await signOut(auth);
            // Use a small timeout to let the UI react/cleanup before blocking with alert
            setTimeout(() => {
                alert(reason);
                window.location.href = '/'; // Hard redirect ensures a clean state
            }, 100);
        } catch (error) {
            console.error("Session guard logout error:", error);
        }
    }, []);

    useEffect(() => {
        if (!user) return;

        // Reset idle timer on mount/re-login
        lastActivity.current = Date.now();

        const updateActivity = () => {
            // Throttle: Only update if > 1 second has passed to prevent performance hits
            const now = Date.now();
            if (now - lastActivity.current > 1000) {
                lastActivity.current = now;
            }
        };

        // Include mousemove but utilize passive listeners for performance
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'mousemove'];
        events.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));

        const checkInterval = setInterval(() => {
            const now = Date.now();
            
            // 1. Check Idle Time (15m)
            // Relies on local browser activity. 
            if (now - lastActivity.current > IDLE_TIMEOUT) {
                clearInterval(checkInterval);
                logout("You have been logged out due to 15 minutes of inactivity.");
                return;
            }

            // 2. Check Absolute Max Duration (4h)
            // Relies on the actual Firebase session creation time.
            const firebaseUser = auth.currentUser;
            if (firebaseUser?.metadata?.lastSignInTime) {
                const signInTime = new Date(firebaseUser.metadata.lastSignInTime).getTime();
                if (now - signInTime > MAX_SESSION_TIME) {
                    clearInterval(checkInterval);
                    logout("For security, your session has expired after 4 hours. Please log in again.");
                    return;
                }
            }
        }, 5000); // Check every 5 seconds

        return () => {
            events.forEach(evt => window.removeEventListener(evt, updateActivity));
            clearInterval(checkInterval);
        };
    }, [user, logout]);
};
