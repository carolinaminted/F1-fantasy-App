// Fix: Add a detailed points system and mock race results to enable dynamic scoring calculations.
import { Constructor, Driver, EntityClass, Event, PickSelection, User } from './types';

export const CONSTRUCTORS: Constructor[] = [
  // Class A
  { id: 'ferrari', name: 'Ferrari', class: EntityClass.A },
  { id: 'mclaren', name: 'McLaren', class: EntityClass.A },
  { id: 'red_bull', name: 'Red Bull Racing', class: EntityClass.A },
  { id: 'mercedes', name: 'Mercedes', class: EntityClass.A },
  { id: 'williams', name: 'Williams', class: EntityClass.A },
  // Class B
  { id: 'aston_martin', name: 'Aston Martin', class: EntityClass.B },
  { id: 'kick_sauber', name: 'Kick Sauber', class: EntityClass.B },
  { id: 'alpine', name: 'Alpine', class: EntityClass.B },
  { id: 'racing_bulls', name: 'Racing Bulls', class: EntityClass.B },
  { id: 'haas', name: 'Haas F1 Team', class: EntityClass.B },
  { id: 'cadillac', name: 'Cadillac', class: EntityClass.B },
];

export const DRIVERS: Driver[] = [
  // Class A
  { id: 'lec', name: 'Charles Leclerc', constructorId: 'ferrari', class: EntityClass.A },
  { id: 'sai', name: 'Carlos Sainz', constructorId: 'ferrari', class: EntityClass.A },
  { id: 'nor', name: 'Lando Norris', constructorId: 'mclaren', class: EntityClass.A },
  { id: 'pia', name: 'Oscar Piastri', constructorId: 'mclaren', class: EntityClass.A },
  { id: 'ver', name: 'Max Verstappen', constructorId: 'red_bull', class: EntityClass.A },
  { id: 'per', name: 'Sergio Pérez', constructorId: 'red_bull', class: EntityClass.A },
  { id: 'ham', name: 'Lewis Hamilton', constructorId: 'mercedes', class: EntityClass.A },
  { id: 'rus', name: 'George Russell', constructorId: 'mercedes', class: EntityClass.A },
  { id: 'alb', name: 'Alexander Albon', constructorId: 'williams', class: EntityClass.A },
  { id: 'sar', name: 'Logan Sargeant', constructorId: 'williams', class: EntityClass.A },
  // Class B
  { id: 'alo', name: 'Fernando Alonso', constructorId: 'aston_martin', class: EntityClass.B },
  { id: 'str', name: 'Lance Stroll', constructorId: 'aston_martin', class: EntityClass.B },
  { id: 'bot', name: 'Valtteri Bottas', constructorId: 'kick_sauber', class: EntityClass.B },
  { id: 'zho', name: 'Guanyu Zhou', constructorId: 'kick_sauber', class: EntityClass.B },
  { id: 'gas', name: 'Pierre Gasly', constructorId: 'alpine', class: EntityClass.B },
  { id: 'oco', name: 'Esteban Ocon', constructorId: 'alpine', class: EntityClass.B },
  { id: 'ric', name: 'Daniel Ricciardo', constructorId: 'racing_bulls', class: EntityClass.B },
  { id: 'tsu', name: 'Yuki Tsunoda', constructorId: 'racing_bulls', class: EntityClass.B },
  { id: 'mag', name: 'Kevin Magnussen', constructorId: 'haas', class: EntityClass.B },
  { id: 'hul', name: 'Nico Hülkenberg', constructorId: 'haas', class: EntityClass.B },
  { id: 'pal', name: 'Alex Palou', constructorId: 'cadillac', class: EntityClass.B },
  { id: 'her', name: 'Colton Herta', constructorId: 'cadillac', class: EntityClass.B },
];


const generateEventDate = (base: Date, daysToAdd: number) => {
    const newDate = new Date(base);
    newDate.setDate(newDate.getDate() + daysToAdd);
    return {
        lockAtUtc: newDate.toISOString(),
        softDeadlineUtc: new Date(newDate.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    };
};

const baseDate = new Date(); // Use today as a starting point for dynamic dates
baseDate.setHours(14, 0, 0, 0); // Set a consistent time for lock-in

export const EVENTS: Event[] = [
    { id: 'aus_26', round: 1, name: 'Australian GP', country: 'Australia', hasSprint: false, ...generateEventDate(baseDate, -7 * 2) },
    { id: 'chn_26', round: 2, name: 'Chinese GP', country: 'China', hasSprint: true, ...generateEventDate(baseDate, -7 * 1) },
    { id: 'jpn_26', round: 3, name: 'Japanese GP', country: 'Japan', hasSprint: false, ...generateEventDate(baseDate, 7 * 1) },
    { id: 'bhr_26', round: 4, name: 'Bahrain GP', country: 'Bahrain', hasSprint: false, ...generateEventDate(baseDate, 7 * 2) },
    { id: 'sau_26', round: 5, name: 'Saudi Arabian GP', country: 'Saudi Arabia', hasSprint: false, ...generateEventDate(baseDate, 7 * 3) },
    { id: 'mia_26', round: 6, name: 'Miami GP', country: 'USA', hasSprint: true, ...generateEventDate(baseDate, 7 * 4) },
    { id: 'can_26', round: 7, name: 'Canadian GP', country: 'Canada', hasSprint: true, ...generateEventDate(baseDate, 7 * 5) },
    { id: 'mco_26', round: 8, name: 'Monaco GP', country: 'Monaco', hasSprint: false, ...generateEventDate(baseDate, 7 * 6) },
    { id: 'esp_26', round: 9, name: 'Spanish GP', country: 'Spain', hasSprint: false, ...generateEventDate(baseDate, 7 * 7) },
    { id: 'aut_26', round: 10, name: 'Austrian GP', country: 'Austria', hasSprint: false, ...generateEventDate(baseDate, 7 * 8) },
    { id: 'gbr_26', round: 11, name: 'British GP', country: 'Great Britain', hasSprint: true, ...generateEventDate(baseDate, 7 * 9) },
    { id: 'bel_26', round: 12, name: 'Belgian GP', country: 'Belgium', hasSprint: false, ...generateEventDate(baseDate, 7 * 10) },
    { id: 'hun_26', round: 13, name: 'Hungarian GP', country: 'Hungary', hasSprint: false, ...generateEventDate(baseDate, 7 * 11) },
    { id: 'nld_26', round: 14, name: 'Dutch GP', country: 'Netherlands', hasSprint: true, ...generateEventDate(baseDate, 7 * 12) },
    { id: 'ita_26', round: 15, name: 'Italian GP', country: 'Italy', hasSprint: false, ...generateEventDate(baseDate, 7 * 13) },
    { id: 'mad_26', round: 16, name: 'Madrid GP', country: 'Spain', hasSprint: false, ...generateEventDate(baseDate, 7 * 14) },
    { id: 'aze_26', round: 17, name: 'Azerbaijan GP', country: 'Azerbaijan', hasSprint: false, ...generateEventDate(baseDate, 7 * 15) },
    { id: 'sgp_26', round: 18, name: 'Singapore GP', country: 'Singapore', hasSprint: true, ...generateEventDate(baseDate, 7 * 16) },
    { id: 'usa_26', round: 19, name: 'United States GP', country: 'USA', hasSprint: false, ...generateEventDate(baseDate, 7 * 17) },
    { id: 'mex_26', round: 20, name: 'Mexico City GP', country: 'Mexico', hasSprint: false, ...generateEventDate(baseDate, 7 * 18) },
    { id: 'bra_26', round: 21, name: 'Sao Paulo GP', country: 'Brazil', hasSprint: false, ...generateEventDate(baseDate, 7 * 19) },
    { id: 'las_26', round: 22, name: 'Las Vegas GP', country: 'USA', hasSprint: false, ...generateEventDate(baseDate, 7 * 20) },
    { id: 'qat_26', round: 23, name: 'Qatar GP', country: 'Qatar', hasSprint: false, ...generateEventDate(baseDate, 7 * 21) },
    { id: 'abu_26', round: 24, name: 'Abu Dhabi GP', country: 'Abu Dhabi', hasSprint: false, ...generateEventDate(baseDate, 7 * 22) },
];


export const USAGE_LIMITS = {
  [EntityClass.A]: { teams: 10, drivers: 8 },
  [EntityClass.B]: { teams: 5, drivers: 5 },
};

export const POINTS_SYSTEM = {
  grandPrixFinish: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  sprintFinish: [8, 7, 6, 5, 4, 3, 2, 1],
  fastestLap: 5,
  gpQualifying: [3, 2, 1],
  sprintQualifying: [3, 2, 1],
};

export const MOCK_RACE_RESULTS: { [eventId: string]: any } = {
  'aus_26': {
    grandPrixFinish: ['ver', 'lec', 'nor', 'sai', 'per', 'pia', 'rus', 'alo', 'ham', 'tsu'],
    gpQualifying: ['ver', 'lec', 'sai'],
    fastestLap: 'lec',
  },
  'chn_26': {
    grandPrixFinish: ['lec', 'nor', 'ver', 'sai', 'per', 'pia', 'rus', 'alo', 'ham', 'tsu'],
    sprintFinish: ['nor', 'ham', 'ver', 'sai', 'lec', 'per', 'pia', 'rus'],
    gpQualifying: ['lec', 'ver', 'nor'],
    sprintQualifying: ['nor', 'ham', 'ver'],
    fastestLap: 'ver',
  },
  'jpn_26': {
    grandPrixFinish: ['ver', 'per', 'sai', 'lec', 'nor', 'alo', 'rus', 'pia', 'ham', 'tsu'],
    gpQualifying: ['ver', 'per', 'nor'],
    fastestLap: 'ver',
  },
};

export let MOCK_USERS: User[] = [
  { id: 'user-001', displayName: 'Team Principal', email: 'admin@fantasy.f1' },
  { id: 'user-002', displayName: 'Awesome Racing', email: 'awesome@fantasy.f1' },
  { id: 'user-003', displayName: 'Velocity Vipers', email: 'velocity@fantasy.f1' },
  { id: 'user-004', displayName: 'Circuit Breakers', email: 'circuit@fantasy.f1' },
  { id: 'user-005', displayName: 'Apex Predators', email: 'apex@fantasy.f1' },
  { id: 'user-006', displayName: 'Grid Masters', email: 'grid@fantasy.f1' },
];

export let MOCK_SEASON_PICKS: { [userId: string]: { [eventId: string]: PickSelection } } = {
  'user-001': {
    'aus_26': { aTeams: ['ferrari', 'red_bull'], bTeam: 'racing_bulls', aDrivers: ['ver', 'lec', 'sai'], bDrivers: ['ric', 'tsu'], fastestLap: 'ver' },
    'chn_26': { aTeams: ['mclaren', 'ferrari'], bTeam: 'haas', aDrivers: ['nor', 'lec', 'pia'], bDrivers: ['mag', 'hul'], fastestLap: 'nor' },
  },
  'user-002': {
    'aus_26': { aTeams: ['red_bull', 'mclaren'], bTeam: 'aston_martin', aDrivers: ['ver', 'per', 'nor'], bDrivers: ['alo', 'str'], fastestLap: 'ver' },
    'chn_26': { aTeams: ['red_bull', 'ferrari'], bTeam: 'kick_sauber', aDrivers: ['ver', 'per', 'lec'], bDrivers: ['bot', 'zho'], fastestLap: 'per' },
  },
  'user-003': {
    'aus_26': { aTeams: ['ferrari', 'mercedes'], bTeam: 'alpine', aDrivers: ['lec', 'sai', 'ham'], bDrivers: ['gas', 'oco'], fastestLap: 'lec' },
  },
  'user-004': {
    'aus_26': { aTeams: ['mclaren', 'williams'], bTeam: 'haas', aDrivers: ['nor', 'pia', 'alb'], bDrivers: ['mag', 'hul'], fastestLap: 'nor' },
    'chn_26': { aTeams: ['mclaren', 'mercedes'], bTeam: 'aston_martin', aDrivers: ['nor', 'pia', 'rus'], bDrivers: ['alo', 'str'], fastestLap: 'pia' },
  },
  'user-005': {
    'aus_26': { aTeams: ['red_bull', 'ferrari'], bTeam: 'racing_bulls', aDrivers: ['ver', 'lec', 'per'], bDrivers: ['ric', 'tsu'], fastestLap: 'ver' },
  },
   'user-006': {
    'aus_26': { aTeams: ['mercedes', 'williams'], bTeam: 'cadillac', aDrivers: ['ham', 'rus', 'alb'], bDrivers: ['pal', 'her'], fastestLap: 'ham' },
    'chn_26': { aTeams: ['mercedes', 'ferrari'], bTeam: 'alpine', aDrivers: ['ham', 'rus', 'lec'], bDrivers: ['gas', 'oco'], fastestLap: 'rus' },
  },
};