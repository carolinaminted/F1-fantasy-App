
export enum EntityClass {
  A = 'A',
  B = 'B'
}

export interface Constructor {
  id: string;
  name: string;
  class: EntityClass;
  isActive: boolean;
  color: string;
}

export interface Driver {
  id: string;
  name: string;
  constructorId: string;
  class: EntityClass;
  isActive: boolean;
}

export interface Event {
  id: string;
  round: number;
  name: string;
  country: string;
  location: string;
  circuit: string;
  hasSprint: boolean;
  lockAtUtc: string;
  softDeadlineUtc: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  duesPaidStatus?: 'Paid' | 'Unpaid';
  rank?: number;
  totalPoints?: number;
  breakdown?: {
      gp: number;
      sprint: number;
      quali: number;
      fl: number;
      p22: number;
  };
  displayRank?: number; // Client-side calc
}

export interface PickSelection {
  aTeams: (string | null)[];
  bTeam: string | null;
  aDrivers: (string | null)[];
  bDrivers: (string | null)[];
  fastestLap: string | null;
  penalty?: number;
  penaltyReason?: string;
}

export interface EventResult {
  grandPrixFinish?: (string | null)[];
  sprintFinish?: (string | null)[];
  gpQualifying?: (string | null)[];
  sprintQualifying?: (string | null)[];
  fastestLap: string | null;
  p22Driver: string | null;
  driverTeams?: { [driverId: string]: string };
  scoringSnapshot?: PointsSystem;
}

export interface RaceResults {
  [eventId: string]: EventResult;
}

export interface PointsSystem {
  grandPrixFinish: number[];
  sprintFinish: number[];
  fastestLap: number;
  gpQualifying: number[];
  sprintQualifying: number[];
}

export interface ScoringProfile {
    id: string;
    name: string;
    config: PointsSystem;
}

export interface ScoringSettingsDoc {
    activeProfileId: string;
    profiles: ScoringProfile[];
}

export interface EventSchedule {
    eventId: string;
    name?: string;
    hasSprint?: boolean;
    fp1?: string;
    fp2?: string;
    fp3?: string;
    qualifying?: string;
    sprintQualifying?: string;
    sprint?: string;
    race?: string;
    customLockAt?: string;
}

export interface InvitationCode {
    code: string;
    status: 'active' | 'reserved' | 'used';
    createdAt: any; // Timestamp
    usedAt?: any; // Timestamp
    usedByEmail?: string;
    reservedAt?: any; // Timestamp
    reservedFor?: string; // Admin manual reservation note
}

export interface AdminLogEntry {
    id: string;
    adminId: string;
    adminName: string;
    eventId: string;
    eventName: string;
    action: string;
    changes: string;
    timestamp?: any;
}

export interface UsageRollup {
    teams: { [id: string]: number };
    drivers: { [id: string]: number };
}

export interface EventPointsBreakdown {
    totalPoints: number;
    grandPrixPoints: number;
    sprintPoints: number;
    fastestLapPoints: number;
    gpQualifyingPoints: number;
    sprintQualifyingPoints: number;
    penaltyPoints: number;
    p22Count: number;
}

export interface LeaderboardCache {
    users: User[];
    allPicks: { [userId: string]: { [eventId: string]: PickSelection } };
    source: 'public' | 'private_fallback';
    lastUpdated: number;
    lastDoc?: any;
}

export interface LeagueConfig {
    duesAmount: number;
}

export interface MaintenanceState {
    enabled: boolean;
    message?: string;
    enabled_by?: string;
    enabled_at?: any;
}