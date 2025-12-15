
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
            setShowWarning(false); // Clean up modal
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

    // 2. Timer Interval Effect
    useEffect(() => {
        if (!user) return;

        const checkInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivity.current;
            
            // Check Idle Time
            if (timeSinceLastActivity > IDLE_TIMEOUT) {
                clearInterval(checkInterval);
                forceLogout("You have been logged out due to 15 minutes of inactivity.");
                return;
            }

            // Check Warning Threshold
            // If we cross the warning threshold and aren't already showing the warning
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
        // Expose a standard logout that just signs out without the "Force" alert, for the modal button
        logout: () => signOut(auth) 
    };
};