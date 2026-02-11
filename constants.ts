import { Constructor, Driver, EntityClass, Event, PointsSystem, RaceResults } from './types.ts';

export const LEAGUE_DUES_AMOUNT = 25; // in USD
export const VENMO_PROFILE_URL = 'https://venmo.com/u/John-Mckenna-4';
export const DONATION_VENMO_URL = 'https://venmo.com/u/nexuslife42';
export const CURRENT_SEASON = '2026';
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

export const EVENTS: Event[] = [
    { id: 'aus_26', round: 1, name: 'Australian GP', country: 'Australia', location: 'Melbourne', circuit: 'Albert Park Circuit', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'chn_26', round: 2, name: 'Chinese GP', country: 'China', location: 'Shanghai', circuit: 'Shanghai International Circuit', hasSprint: true, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'jpn_26', round: 3, name: 'Japanese GP', country: 'Japan', location: 'Suzuka', circuit: 'Suzuka International Racing Course', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'bhr_26', round: 4, name: 'Bahrain GP', country: 'Bahrain', location: 'Sakhir', circuit: 'Bahrain International Circuit', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'sau_26', round: 5, name: 'Saudi Arabian GP', country: 'Saudi Arabia', location: 'Jeddah', circuit: 'Jeddah Corniche Circuit', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'mia_26', round: 6, name: 'Miami GP', country: 'USA', location: 'Miami', circuit: 'Miami International Autodrome', hasSprint: true, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'can_26', round: 7, name: 'Canadian GP', country: 'Canada', location: 'Montreal', circuit: 'Circuit Gilles-Villeneuve', hasSprint: true, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'mco_26', round: 8, name: 'Monaco GP', country: 'Monaco', location: 'Monaco', circuit: 'Circuit de Monaco', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'esp_26', round: 9, name: 'Spanish GP', country: 'Spain', location: 'Barcelona-Catalunya', circuit: 'Circuit de Barcelona-Catalunya', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'aut_26', round: 10, name: 'Austrian GP', country: 'Austria', location: 'Spielberg', circuit: 'Red Bull Ring', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'gbr_26', round: 11, name: 'British GP', country: 'Great Britain', location: 'Silverstone', circuit: 'Silverstone Circuit', hasSprint: true, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'bel_26', round: 12, name: 'Belgian GP', country: 'Belgium', location: 'Spa-Francorchamps', circuit: 'Circuit de Spa-Francorchamps', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'hun_26', round: 13, name: 'Hungarian GP', country: 'Hungary', location: 'Budapest', circuit: 'Hungaroring', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'nld_26', round: 14, name: 'Dutch GP', country: 'Netherlands', location: 'Zandvoort', circuit: 'Circuit Zandvoort', hasSprint: true, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'ita_26', round: 15, name: 'Italian GP', country: 'Italy', location: 'Monza', circuit: 'Autodromo Nazionale Monza', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'mad_26', round: 16, name: 'Madrid GP', country: 'Spain', location: 'Madrid (New Circuit)', circuit: 'IFEMA Madrid Circuit', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'aze_26', round: 17, name: 'Azerbaijan GP', country: 'Azerbaijan', location: 'Baku', circuit: 'Baku City Circuit', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'sgp_26', round: 18, name: 'Singapore GP', country: 'Singapore', location: 'Marina Bay', circuit: 'Marina Bay Street Circuit', hasSprint: true, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'usa_26', round: 19, name: 'United States GP', country: 'USA', location: 'Austin (COTA)', circuit: 'Circuit of the Americas', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'mex_26', round: 20, name: 'Mexico City GP', country: 'Mexico', location: 'Mexico City', circuit: 'Autódromo Hermanos Rodríguez', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'bra_26', round: 21, name: 'Sao Paulo GP', country: 'Brazil', location: 'Interlagos', circuit: 'Autódromo de Interlagos', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'las_26', round: 22, name: 'Las Vegas GP', country: 'USA', location: 'Las Vegas', circuit: 'Las Vegas Strip Circuit', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'qat_26', round: 23, name: 'Qatar GP', country: 'Qatar', location: 'Lusail', circuit: 'Lusail International Circuit', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
    { id: 'abu_26', round: 24, name: 'Abu Dhabi GP', country: 'Abu Dhabi', location: 'Yas Marina', circuit: 'Yas Marina Circuit', hasSprint: false, lockAtUtc: '', softDeadlineUtc: '' },
];

export const USAGE_LIMITS = {
  [EntityClass.A]: { teams: 10, drivers: 8 },
  [EntityClass.B]: { teams: 4, drivers: 4 },
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