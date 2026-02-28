import { useState, useEffect, useMemo } from 'react';
import { GeneralAnnouncementState, User } from '../types.ts';
import { onGeneralAnnouncement } from '../services/firestoreService.ts';

export const useGeneralAnnouncement = (user: User | null) => {
    const [announcement, setAnnouncement] = useState<GeneralAnnouncementState | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setAnnouncement(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = onGeneralAnnouncement((state) => {
            setAnnouncement(state);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const shouldShow = useMemo(() => {
        if (loading) return false;
        if (!announcement || !announcement.active) return false;
        if (!user) return false;
        if (user.dismissedAnnouncements?.includes(announcement.announcementId)) return false;
        return true;
    }, [announcement, user, loading]);

    return { announcement, shouldShow, loading };
};

export default useGeneralAnnouncement;
