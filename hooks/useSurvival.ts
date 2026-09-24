import { useEffect, useState } from 'react';
import type { SurvivalConfig, SurvivalPicksDoc, SurvivalStandings } from '../types.ts';
import {
    getPublicDisplayNames, onAllSurvivalPicks, onSurvivalConfig, onSurvivalStandings,
} from '../services/firestoreService.ts';

export interface SurvivalState {
    config: SurvivalConfig | null;
    standings: SurvivalStandings | null;
    picks: { [uid: string]: SurvivalPicksDoc };
    names: { [uid: string]: string };
    loading: boolean;
}

/** Everything the survival surfaces read, live. Picks and names only load when `full` is set. */
export const useSurvival = (full = true): SurvivalState => {
    const [config, setConfig] = useState<SurvivalConfig | null>(null);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [standings, setStandings] = useState<SurvivalStandings | null>(null);
    const [picks, setPicks] = useState<{ [uid: string]: SurvivalPicksDoc }>({});
    const [names, setNames] = useState<{ [uid: string]: string }>({});

    useEffect(() => onSurvivalConfig(c => { setConfig(c); setConfigLoaded(true); }), []);
    useEffect(() => onSurvivalStandings(setStandings), []);
    useEffect(() => (full ? onAllSurvivalPicks(setPicks) : undefined), [full]);
    useEffect(() => {
        if (!full) return;
        let live = true;
        getPublicDisplayNames().then(n => { if (live) setNames(n); }).catch(err => console.error(err));
        return () => { live = false; };
    }, [full]);

    return { config, standings, picks, names, loading: !configLoaded };
};
