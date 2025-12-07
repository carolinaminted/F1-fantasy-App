
// Fix: Create types definitions for the application.
export enum EntityClass {
  A = 'A',
  B = 'B',
}

export interface User {
  id: string;
  displayName: string;
  email: string;
  duesPaidStatus?: 'Paid' | 'Unpaid';
  isAdmin?: boolean;
}

export interface Constructor {
  id: string;
  name: string;
  class: EntityClass;
}

export interface Driver {
  id: string;
  name: string;
  constructorId: string;
  class: EntityClass;
}

export interface Event {
  id: string;
  round: number;
  name: string;
  country: string;
  hasSprint: boolean;
  lockAtUtc: string;
  softDeadlineUtc: string;
}

export interface PickSelection {
  aTeams: (string | null)[];
  bTeam: string | null;
  aDrivers: (string | null)[];
  bDrivers: (string | null)[];
  fastestLap: string | null;
}

export interface EventResult {
  grandPrixFinish: (string | null)[];
  gpQualifying: (string | null)[];
  fastestLap: string | null;
  sprintFinish?: (string | null)[];
  sprintQualifying?: (string | null)[];
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