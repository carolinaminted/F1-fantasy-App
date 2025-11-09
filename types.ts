export enum EntityClass {
  A = 'A',
  B = 'B',
}

export interface Constructor {
  id: string;
  name: string;
  class: EntityClass;
}

export interface Driver {
  id:string;
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

export interface Usage {
  [entityId: string]: number;
}

export interface UsageRollup {
  teams: Usage;
  drivers: Usage;
}

export interface User {
  id: string;
  displayName: string;
  email: string;
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
