import { EntityClass } from './types.ts';
import type { Constructor, Driver, Event, PointsSystem, RaceResults } from './types.ts';

export const LEAGUE_TIMEZONE = 'America/New_York';
export const LEAGUE_DUES_AMOUNT = 25; // in USD
export const VENMO_PROFILE_URL = 'https://venmo.com/u/John-Mckenna-4';
export const DONATION_VENMO_URL = 'https://venmo.com/u/nexuslife42';
export const SESSION_STORAGE_KEY = 'ff1_session_activity';

export const CONSTRUCTORS: Constructor[] = [
  { id: 'mclaren', name: 'McLaren', class: EntityClass.A, isActive: true, color: '#FF8000' },
  { id: 'mercedes', name: 'Mercedes', class: EntityClass.A, isActive: true, color: '#27F4D2' },
  { id: 'red_bull', name: 'Red Bull Racing', class: EntityClass.A, isActive: true, color: '#3671C6' },
  { id: 'ferrari', name: 'Ferrari', class: EntityClass.A, isActive: true, color: '#E8002D' },
  { id: 'williams', name: 'Williams', class: EntityClass.A, isActive: true, color: '#64C4FF' },
  { id: 'racing_bulls', name: 'Racing Bulls', class: EntityClass.B, isActive: true, color: '#6692FF' },
  { id: 'aston_martin', name: 'Aston Martin', class: EntityClass.B, isActive: true, color: '#229971' },
  { id: 'haas', name: 'Haas F1 Team', class: EntityClass.B, isActive: true, color: '#B6BABD' },
  { id: 'audi', name: 'Audi F1 Team', class: EntityClass.B, isActive: true, color: '#F20505' },
  { id: 'alpine', name: 'Alpine', class: EntityClass.B, isActive: true, color: '#0090FF' },
  { id: 'cadillac', name: 'Cadillac F1 Team', class: EntityClass.B, isActive: true, color: '#FCD12A' },
];

export const DRIVERS: Driver[] = [
  { id: 'nor', name: 'Lando Norris', constructorId: 'mclaren', class: EntityClass.A, isActive: true },
  { id: 'pia', name: 'Oscar Piastri', constructorId: 'mclaren', class: EntityClass.A, isActive: true },
  { id: 'rus', name: 'George Russell', constructorId: 'mercedes', class: EntityClass.A, isActive: true },
  { id: 'ant', name: 'Kimi Antonelli', constructorId: 'mercedes', class: EntityClass.A, isActive: true },
  { id: 'ver', name: 'Max Verstappen', constructorId: 'red_bull', class: EntityClass.A, isActive: true },
  { id: 'had', name: 'Isack Hadjar', constructorId: 'red_bull', class: EntityClass.A, isActive: true },
  { id: 'ham', name: 'Lewis Hamilton', constructorId: 'ferrari', class: EntityClass.A, isActive: true },
  { id: 'lec', name: 'Charles Leclerc', constructorId: 'ferrari', class: EntityClass.A, isActive: true },
  { id: 'sai', name: 'Carlos Sainz', constructorId: 'williams', class: EntityClass.A, isActive: true },
  { id: 'alb', name: 'Alex Albon', constructorId: 'williams', class: EntityClass.A, isActive: true },
  { id: 'law', name: 'Liam Lawson', constructorId: 'racing_bulls', class: EntityClass.B, isActive: true },
  { id: 'lin', name: 'Arvid Lindblad', constructorId: 'racing_bulls', class: EntityClass.B, isActive: true },
  { id: 'alo', name: 'Fernando Alonso', constructorId: 'aston_martin', class: EntityClass.B, isActive: true },
  { id: 'str', name: 'Lance Stroll', constructorId: 'aston_martin', class: EntityClass.B, isActive: true },
  { id: 'oco', name: 'Esteban Ocon', constructorId: 'haas', class: EntityClass.B, isActive: true },
  { id: 'bea', name: 'Oliver Bearman', constructorId: 'haas', class: EntityClass.B, isActive: true },
  { id: 'hul', name: 'Nico Hülkenberg', constructorId: 'audi', class: EntityClass.B, isActive: true },
  { id: 'bor', name: 'Gabriel Bortoleto', constructorId: 'audi', class: EntityClass.B, isActive: true },
  { id: 'gas', name: 'Pierre Gasly', constructorId: 'alpine', class: EntityClass.B, isActive: true },
  { id: 'col', name: 'Franco Colapinto', constructorId: 'alpine', class: EntityClass.B, isActive: true },
  { id: 'per', name: 'Sergio Pérez', constructorId: 'cadillac', class: EntityClass.B, isActive: true },
  { id: 'bot', name: 'Valtteri Bottas', constructorId: 'cadillac', class: EntityClass.B, isActive: true },
];

export const USAGE_LIMITS = {
  [EntityClass.A]: { teams: 10, drivers: 8 },
  [EntityClass.B]: { teams: 5, drivers: 5 },
};

// Fix: Imported PointsSystem to resolve "Cannot find name 'PointsSystem'" error.
export const DEFAULT_POINTS_SYSTEM: PointsSystem = {
  grandPrixFinish: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  sprintFinish: [8, 7, 6, 5, 4, 3, 2, 1],
  fastestLap: 3,
  gpQualifying: [3, 2, 1],
  sprintQualifying: [3, 2, 1],
};

export let RACE_RESULTS: RaceResults = {};