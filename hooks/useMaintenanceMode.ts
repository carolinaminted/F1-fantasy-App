
import { useState, useEffect } from 'react';
import { MaintenanceState } from '../types.ts';
import { onMaintenanceState } from '../services/firestoreService.ts';

export const useMaintenanceMode = () => {
    const [maintenance, setMaintenance] = useState<MaintenanceState | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onMaintenanceState((state) => {
            setMaintenance(state);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { maintenance, loading };
};
