
import { PickSelection, RaceResults, EventResult, EntityClass, User, PointsSystem } from '../types';
import { CONSTRUCTORS, DRIVERS, EVENTS, DEFAULT_POINTS_SYSTEM } from '../constants';
import { calculateScoreRollup } from './scoringService';

// --- Types ---
export interface SimulationReport {
    seasonCount: number;
    totalRacesSimulated: number;
    totalPicksProcessed: number;
    anomalies: string[];
    integrityScore: number; // 0-100
    executionTimeMs: number;
}

// --- Generators ---

const generateRandomResult = (hasSprint: boolean): EventResult => {
    // Shuffle drivers for random results
    const shuffled = [...DRIVERS].sort(() => 0.5 - Math.random());
    const podium = shuffled.slice(0, 10).map(d => d.id);
    const quali = shuffled.slice(0, 3).map(d => d.id);
    
    return {
        grandPrixFinish: podium,
        gpQualifying: quali,
        fastestLap: shuffled[0].id,
        ...(hasSprint && {
            sprintFinish: shuffled.slice(0, 8).map(d => d.id),
            sprintQualifying: shuffled.slice(0, 3).map(d => d.id),
        })
    };
};

const generateRandomPicks = (): PickSelection => {
    const aTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.A);
    const bTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.B);
    const aDrivers = DRIVERS.filter(d => d.class === EntityClass.A);
    const bDrivers = DRIVERS.filter(d => d.class === EntityClass.B);

    const rand = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

    return {
        aTeams: [rand(aTeams).id, rand(aTeams).id],
        bTeam: rand(bTeams).id,
        aDrivers: [rand(aDrivers).id, rand(aDrivers).id, rand(aDrivers).id],
        bDrivers: [rand(bDrivers).id, rand(bDrivers).id],
        fastestLap: rand(DRIVERS).id
    };
};

// --- The Engine ---

export const runSeasonSimulation = async (seasonsToSimulate: number = 1, pointsSystem: PointsSystem = DEFAULT_POINTS_SYSTEM): Promise<SimulationReport> => {
    const startTime = performance.now();
    const anomalies: string[] = [];
    let totalPicks = 0;
    
    // 1. Snapshot Constants (Simulating the "Rule Change" Ripple Effect)
    // In a real app, we'd modify these to test breakage, but here we track consistency.
    // const initialPointsSystem = JSON.stringify(pointsSystem); 

    for (let season = 1; season <= seasonsToSimulate; season++) {
        // Mock 10 Users per season for speed (scales to 1000s linearly)
        const mockUsers = Array.from({ length: 10 }, (_, i) => `sim-user-${season}-${i}`);
        
        // Mock Results for all 24 events
        const seasonResults: RaceResults = {};
        EVENTS.forEach(event => {
            seasonResults[event.id] = generateRandomResult(event.hasSprint);
        });

        // Process Users
        mockUsers.forEach(userId => {
            const seasonPicks: { [eventId: string]: PickSelection } = {};
            
            // User makes picks for every race
            EVENTS.forEach(event => {
                seasonPicks[event.id] = generateRandomPicks();
                totalPicks++;
            });

            // Calculate Score
            try {
                const score = calculateScoreRollup(seasonPicks, seasonResults, pointsSystem);
                
                // Audit Logic: Sanity Check
                if (Number.isNaN(score.totalPoints)) {
                    anomalies.push(`Season ${season}: User ${userId} produced NaN score.`);
                }
                if (score.totalPoints < 0) {
                    anomalies.push(`Season ${season}: User ${userId} produced negative score.`);
                }
                
                // Audit Logic: Driver Transfer Simulation
                // Every 10th season, simulate a "Logic Break" where we verify if static team IDs hold up
                if (season % 10 === 0 && userId.endsWith('-1')) {
                    // This is a meta-check. In a real db, if DRIVERS changed, this score would drift.
                    // We verify here that 'constructorId' lookup never fails to return a value.
                    const pickedDriver = seasonPicks[EVENTS[0].id].aDrivers[0];
                    if(pickedDriver) {
                         const driverObj = DRIVERS.find(d => d.id === pickedDriver);
                         if(!driverObj) anomalies.push(`Season ${season}: Critical - Driver ${pickedDriver} missing from Config.`);
                    }
                }

            } catch (e: any) {
                anomalies.push(`Season ${season}: Calculation crash - ${e.message}`);
            }
        });
    }

    const endTime = performance.now();
    
    // Integrity Score Calculation
    // Deduct points for anomalies
    let integrity = 100;
    integrity -= (anomalies.length * 5);
    if (integrity < 0) integrity = 0;

    return {
        seasonCount: seasonsToSimulate,
        totalRacesSimulated: seasonsToSimulate * EVENTS.length,
        totalPicksProcessed: totalPicks,
        anomalies,
        integrityScore: integrity,
        executionTimeMs: endTime - startTime
    };
};
