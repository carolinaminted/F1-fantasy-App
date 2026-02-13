import { useState, useEffect, useMemo } from 'react';
import { ResultsAnnouncementState, User } from '../types.ts';
import { onResultsAnnouncement } from '../services/firestoreService.ts';

export const useResultsAnnouncement = (user: User | null) => {
    const [announcement, setAnnouncement] = useState<ResultsAnnouncementState | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // If there's no user, we can't fetch data that requires authentication.
        // Clear any existing state and wait.
        if (!user) {
            setAnnouncement(null);
            setLoading(false); // Not loading if we know we can't fetch.
            return;
        }

        setLoading(true);
        const unsubscribe = onResultsAnnouncement((state) => {
            setAnnouncement(state);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]); // FIX: Dependency on `user` ensures the listener is re-created on login/logout.

    const shouldShow = useMemo(() => {
        if (loading) {
            return false;
        }
        if (!announcement || !announcement.active) {
            return false;
        }
        if (!user) {
            return false;
        }
        if (user.dismissedAnnouncements?.includes(announcement.announcementId)) {
            return false;
        }
        return true;
    }, [announcement, user, loading]);

    return { announcement, shouldShow, loading };
};

export default useResultsAnnouncement;
