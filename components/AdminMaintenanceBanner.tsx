import React, { useState } from 'react';
import { setMaintenanceMode } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { Banner } from './ui/index.ts';
import { LockIcon } from './icons/LockIcon.tsx';

interface AdminMaintenanceBannerProps {
    adminId: string;
}

/**
 * Shown to admins while the league is paused, so nobody forgets it is on.
 *
 * Gate admin-1 moved it onto the kit `Banner` (it was hardcoding #DA291C and fighting the
 * sticky wrapper App puts around it with its own `fixed` positioning), and gave the button
 * an object — "Disable" alone never said disable *what*.
 */
const AdminMaintenanceBanner: React.FC<AdminMaintenanceBannerProps> = ({ adminId }) => {
    const { showToast } = useToast();
    const [isEnding, setIsEnding] = useState(false);

    const handleDisable = async () => {
        setIsEnding(true);
        try {
            await setMaintenanceMode(false, adminId);
            showToast("🟢 Green flag — session live", 'success');
        } catch (error) {
            console.error(error);
            showToast("Failed to disable maintenance mode", 'error');
        } finally {
            setIsEnding(false);
        }
    };

    return (
        <Banner
            tone="danger"
            icon={LockIcon}
            title="Red flag — the league is paused"
            message="Members can't sign in. Only admins can use the app right now."
            action={
                <button
                    onClick={handleDisable}
                    disabled={isEnding}
                    className="rounded-lg bg-pure-white px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-primary-red transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    {isEnding ? 'Ending…' : 'End maintenance'}
                </button>
            }
        />
    );
};

export default AdminMaintenanceBanner;
