
import React from 'react';
import { setMaintenanceMode } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';

interface AdminMaintenanceBannerProps {
    adminId: string;
}

const AdminMaintenanceBanner: React.FC<AdminMaintenanceBannerProps> = ({ adminId }) => {
    const { showToast } = useToast();

    const handleDisable = async () => {
        try {
            await setMaintenanceMode(false, adminId);
            showToast("🟢 Green flag — session live", 'success');
        } catch (error) {
            console.error(error);
            showToast("Failed to disable maintenance mode", 'error');
        }
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#DA291C] text-white px-4 py-2 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-xs md:text-sm font-bold uppercase tracking-wide">
                    ⚠ RED FLAG ACTIVE — Non-admin users are locked out
                </span>
            </div>
            <button 
                onClick={handleDisable}
                className="bg-white text-[#DA291C] text-xs font-black uppercase tracking-wider px-3 py-1 rounded shadow-md hover:bg-gray-100 transition-colors"
            >
                Disable
            </button>
        </div>
    );
};

export default AdminMaintenanceBanner;
