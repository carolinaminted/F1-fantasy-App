
// Fix: Create types definitions for the application.
export enum EntityClass {
  A = 'A',
  B = 'B',
}

export interface User {
  id: string;
  displayName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  duesPaidStatus?: 'Paid' | 'Unpaid';
  isAdmin?: boolean;
  invitationCode?: string; // New field
  // Pre-calculated fields from Cloud Function
  totalPoints?: number;
  rank?: number;
  prevRank?: number; // For trending indicators
}

export interface InvitationCode {
  code: string;
  status: 'active' | 'reserved' | 'used';
  createdBy?: string;
  createdAt: any; // Firestore Timestamp
  usedBy?: string;
  usedByEmail?: string;
  usedAt?: any;
  reservedAt?: any;
}

export interface Constructor {
  id: string;
  name: string;
  class: EntityClass;
  isActive: boolean;
  color: string; // New: Team branding color
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
  location: string; // City/Region (Renamed from circuit)
  circuit: string; // Full Track Name
  hasSprint: boolean;
  lockAtUtc: string;
  softDeadlineUtc: string;
}

// New: Detailed schedule for a specific event
export interface EventSchedule {
    eventId: string;
    fp1?: string; // ISO Date String
    fp2?: string;
    fp3?: string;
    qualifying?: string;
    sprintQualifying?: string;
    sprint?: string;
    race?: string;
    // Allow overriding the default calculated lock times
    customLockAt?: string;
    // Overrides
    name?: string;
    hasSprint?: boolean;
}

export interface PickSelection {
  aTeams: (string | null)[];
  bTeam: string | null;
  aDrivers: (string | null)[];
  bDrivers: (string | null)[];
  fastestLap: string | null;
  penalty?: number; // 0.0 to 1.0 (e.g. 0.2 for 20%)
  penaltyReason?: string;
}

export interface EventResult {
  grandPrixFinish: (string | null)[];
  gpQualifying: (string | null)[];
  fastestLap: string | null;
  sprintFinish?: (string | null)[];
  sprintQualifying?: (string | null)[];
  driverTeams?: { [driverId: string]: string }; // Snapshot of driver-team mapping at event time
  scoringSnapshot?: PointsSystem; // Snapshot of points rules used for this result
}

export interface RaceResults {
  [eventId: string]: EventResult;
}

// Fix: Add and export the Donation interface. This type was missing, causing import errors in donation-related components.
export interface Donation {
  id: string;
  userId: string;
  amount: number; // in cents
  currency: string;
  createdAt: { seconds: number; nanoseconds: number };
  methodType: string;
  cardLast4?: string;
  providerTxnId: string;
  status: string;
}

export interface DuesPaymentInitiation {
  id: string; // Firestore document ID
  uid: string;
  email: string;
  amount: number; // in cents
  season: string;
  memo: string;
  status: 'initiated';
  createdAt: { seconds: number; nanoseconds: number };
}

export interface UsageRollup {
    teams: { [id: string]: number };
    drivers: { [id: string]: number };
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

export interface EventPointsBreakdown {
    totalPoints: number;
    grandPrixPoints: number;
    sprintPoints: number;
    fastestLapPoints: number;
    gpQualifyingPoints: number;
    sprintQualifyingPoints: number;
    penaltyPoints: number; // New field
}

export interface LeaderboardCache {
    users: User[];
    allPicks: { [userId: string]: { [eventId: string]: PickSelection } };
    source: 'public' | 'private_fallback';
    lastUpdated: number;
}
