# Scoring Accuracy Simulation Protocol

This file contains the legacy simulation engine used to audit the Formula 1 Fantasy scoring logic.

## Simulation Engine Logic

```typescript
import { PickSelection, RaceResults, EventResult, EntityClass, User, PointsSystem } from '../types.ts';
import { CONSTRUCTORS, DRIVERS, EVENTS, DEFAULT_POINTS_SYSTEM } from '../constants.ts';
import { calculateScoreRollup } from './scoringService.ts';

export interface SimulationReport {
    seasonCount: number;
    totalRacesSimulated: number;
    totalPicksProcessed: number;
    anomalies: string[];
    integrityScore: number;
    executionTimeMs: number;
}

const generateRandomResult = (hasSprint: boolean): EventResult => {
    const shuffled = [...DRIVERS].sort(() => 0.5 - Math.random());
    const podium = shuffled.slice(0, 10).map(d => d.id);
    const quali = shuffled.slice(0, 3).map(d => d.id);
    const driverTeamsSnapshot: { [id: string]: string } = {};
    DRIVERS.forEach(d => { driverTeamsSnapshot[d.id] = d.constructorId; });
    
    return {
        grandPrixFinish: podium,
        gpQualifying: quali,
        fastestLap: shuffled[0].id,
        ...(hasSprint && {
            sprintFinish: shuffled.slice(0, 8).map(d => d.id),
            sprintQualifying: shuffled.slice(0, 3).map(d => d.id),
        }),
        driverTeams: driverTeamsSnapshot
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

export const runSeasonSimulation = async (seasonsToSimulate: number = 1, pointsSystem: PointsSystem = DEFAULT_POINTS_SYSTEM): Promise<SimulationReport> => {
    const startTime = performance.now();
    const anomalies: string[] = [];
    let totalPicks = 0;

    for (let season = 1; season <= seasonsToSimulate; season++) {
        const mockUsers = Array.from({ length: 10 }, (_, i) => `sim-user-${season}-${i}`);
        const seasonResults: RaceResults = {};
        EVENTS.forEach(event => { seasonResults[event.id] = generateRandomResult(event.hasSprint); });

        mockUsers.forEach(userId => {
            const seasonPicks: { [eventId: string]: PickSelection } = {};
            EVENTS.forEach(event => { seasonPicks[event.id] = generateRandomPicks(); totalPicks++; });
            try {
                const score = calculateScoreRollup(seasonPicks, seasonResults, pointsSystem, DRIVERS);
                if (Number.isNaN(score.totalPoints)) anomalies.push(`Season ${season}: User ${userId} produced NaN score.`);
                if (score.totalPoints < 0) anomalies.push(`Season ${season}: User ${userId} produced negative score.`);
            } catch (e: any) {
                anomalies.push(`Season ${season}: Calculation crash - ${e.message}`);
            }
        });
    }

    let integrity = 100 - (anomalies.length * 5);
    if (integrity < 0) integrity = 0;

    return {
        seasonCount: seasonsToSimulate,
        totalRacesSimulated: seasonsToSimulate * EVENTS.length,
        totalPicksProcessed: totalPicks,
        anomalies,
        integrityScore: integrity,
        executionTimeMs: performance.now() - startTime
    };
};
```
