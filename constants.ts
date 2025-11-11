// Fix: Add a detailed points system and mock race results to enable dynamic scoring calculations.
import { Constructor, Driver, EntityClass, Event, PickSelection, User, RaceResults } from './types';

export const LEAGUE_DUES_AMOUNT = 25; // in USD
export const CURRENT_SEASON = '2025';
export const PAYPAL_DONATION_URL = 'https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jhouser1988%40gmail.com&item_name=F1+Fantasy+League+Operational+Costs&currency_code=USD';
export const PAYPAL_PAY_DUES_URL = 'https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jhouser1988%40gmail.com&item_name=Formula+Fantasy+One+Pay+Dues&currency_code=USD';


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
];

export const DRIVERS: Driver[] = [
  // Ferrari (A)
  { id: 'lec', name: 'Charles Leclerc', constructorId: 'ferrari', class: EntityClass.A },
  { id: 'ham', name: 'Lewis Hamilton', constructorId: 'ferrari', class: EntityClass.A },
  // McLaren (A)
  { id: 'nor', name: 'Lando Norris', constructorId: 'mclaren', class: EntityClass.A },
  { id: 'pia', name: 'Oscar Piastri', constructorId: 'mclaren', class: EntityClass.A },
  // Red Bull (A)
  { id: 'ver', name: 'Max Verstappen', constructorId: 'red_bull', class: EntityClass.A },
  { id: 'tsu', name: 'Yuki Tsunoda', constructorId: 'red_bull', class: EntityClass.A },
  // Mercedes (A)
  { id: 'rus', name: 'George Russell', constructorId: 'mercedes', class: EntityClass.A },
  { id: 'ant', name: 'Andrea Kimi Antonelli', constructorId: 'mercedes', class: EntityClass.A },
  // Williams (A)
  { id: 'alb', name: 'Alexander Albon', constructorId: 'williams', class: EntityClass.A },
  { id: 'sai', name: 'Carlos Sainz Jr.', constructorId: 'williams', class: EntityClass.A },
  // Aston Martin (B)
  { id: 'alo', name: 'Fernando Alonso', constructorId: 'aston_martin', class: EntityClass.B },
  { id: 'str', name: 'Lance Stroll', constructorId: 'aston_martin', class: EntityClass.B },
  // Kick Sauber (B)
  { id: 'hul', name: 'Nico Hulkenberg', constructorId: 'kick_sauber', class: EntityClass.B },
  { id: 'bor', name: 'Gabriel Bortoleto', constructorId: 'kick_sauber', class: EntityClass.B },
  // Alpine (B)
  { id: 'gas', name: 'Pierre Gasly', constructorId: 'alpine', class: EntityClass.B },
  { id: 'col', name: 'Franco Colapinto', constructorId: 'alpine', class: EntityClass.B },
  // Racing Bulls (B)
  { id: 'had', name: 'Isack Hadjar', constructorId: 'racing_bulls', class: EntityClass.B },
  { id: 'law', name: 'Liam Lawson', constructorId: 'racing_bulls', class: EntityClass.B },
  // Haas (B)
  { id: 'oco', name: 'Esteban Ocon', constructorId: 'haas', class: EntityClass.B },
  { id: 'bea', name: 'Oliver Bearman', constructorId: 'haas', class: EntityClass.B },
];

const createEventDate = (dateString: string) => {
    const lockAt = new Date(`${dateString}T14:00:00Z`);
    const softDeadline = new Date(lockAt.getTime() - 2 * 60 * 60 * 1000);
    return {
        lockAtUtc: lockAt.toISOString(),
        softDeadlineUtc: softDeadline.toISOString(),
    };
};

export const EVENTS: Event[] = [
    { id: 'aus_25', round: 1, name: 'Australian GP', country: 'Australia', hasSprint: false, ...createEventDate('2025-03-16') },
    { id: 'chn_25', round: 2, name: 'Chinese GP', country: 'China', hasSprint: true, ...createEventDate('2025-03-23') },
    { id: 'jpn_25', round: 3, name: 'Japanese GP', country: 'Japan', hasSprint: false, ...createEventDate('2025-04-06') },
    { id: 'bhr_25', round: 4, name: 'Bahrain GP', country: 'Bahrain', hasSprint: false, ...createEventDate('2025-04-13') },
    { id: 'sau_25', round: 5, name: 'Saudi Arabian GP', country: 'Saudi Arabia', hasSprint: false, ...createEventDate('2025-04-20') },
    { id: 'mia_25', round: 6, name: 'Miami GP', country: 'USA', hasSprint: true, ...createEventDate('2025-05-04') },
    { id: 'emi_25', round: 7, name: 'Emilia-Romagna GP', country: 'Italy', hasSprint: false, ...createEventDate('2025-05-18') },
    { id: 'mco_25', round: 8, name: 'Monaco GP', country: 'Monaco', hasSprint: false, ...createEventDate('2025-05-25') },
    { id: 'esp_25', round: 9, name: 'Spanish GP', country: 'Spain', hasSprint: false, ...createEventDate('2025-06-01') },
    { id: 'can_25', round: 10, name: 'Canadian GP', country: 'Canada', hasSprint: false, ...createEventDate('2025-06-15') },
    { id: 'aut_25', round: 11, name: 'Austrian GP', country: 'Austria', hasSprint: false, ...createEventDate('2025-06-29') },
    { id: 'gbr_25', round: 12, name: 'British GP', country: 'Great Britain', hasSprint: false, ...createEventDate('2025-07-06') },
    { id: 'bel_25', round: 13, name: 'Belgian GP', country: 'Belgium', hasSprint: true, ...createEventDate('2025-07-27') },
    { id: 'hun_25', round: 14, name: 'Hungarian GP', country: 'Hungary', hasSprint: false, ...createEventDate('2025-08-03') },
    { id: 'nld_25', round: 15, name: 'Dutch GP', country: 'Netherlands', hasSprint: false, ...createEventDate('2025-08-31') },
    { id: 'ita_25', round: 16, name: 'Italian GP', country: 'Italy', hasSprint: false, ...createEventDate('2025-09-07') },
    { id: 'aze_25', round: 17, name: 'Azerbaijan GP', country: 'Azerbaijan', hasSprint: false, ...createEventDate('2025-09-21') },
    { id: 'sgp_25', round: 18, name: 'Singapore GP', country: 'Singapore', hasSprint: false, ...createEventDate('2025-10-05') },
    { id: 'usa_25', round: 19, name: 'United States GP', country: 'USA', hasSprint: true, ...createEventDate('2025-10-19') },
    { id: 'mex_25', round: 20, name: 'Mexico City GP', country: 'Mexico', hasSprint: false, ...createEventDate('2025-10-26') },
    { id: 'bra_25', round: 21, name: 'Sao Paulo GP', country: 'Brazil', hasSprint: true, ...createEventDate('2025-11-09') },
    { id: 'las_25', round: 22, name: 'Las Vegas GP', country: 'USA', hasSprint: false, ...createEventDate('2025-11-22') },
    { id: 'qat_25', round: 23, name: 'Qatar GP', country: 'Qatar', hasSprint: true, ...createEventDate('2025-11-30') },
    { id: 'abu_25', round: 24, name: 'Abu Dhabi GP', country: 'Abu Dhabi', hasSprint: false, ...createEventDate('2025-12-07') },
];


export const USAGE_LIMITS = {
  [EntityClass.A]: { teams: 10, drivers: 8 },
  [EntityClass.B]: { teams: 5, drivers: 5 },
};

export const POINTS_SYSTEM = {
  grandPrixFinish: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  sprintFinish: [8, 7, 6, 5, 4, 3, 2, 1],
  fastestLap: 3,
  gpQualifying: [3, 2, 1],
  sprintQualifying: [3, 2, 1],
};

export let RACE_RESULTS: RaceResults = {
  'aus_25': {
    grandPrixFinish: ['nor', 'ver', 'rus', 'ant', 'alb', 'str', 'hul', 'lec', 'pia', 'ham'],
    gpQualifying: ['nor', null, null],
    fastestLap: 'nor',
  },
  'chn_25': {
    grandPrixFinish: ['pia', 'nor', 'rus', 'ver', 'oco', 'ant', 'alb', 'bea', 'str', 'sai'],
    sprintFinish: ['ham', 'pia', 'ver', 'rus', 'lec', 'tsu', 'ant', 'nor'],
    gpQualifying: ['pia', null, null],
    fastestLap: 'nor',
  },
  'jpn_25': {
    grandPrixFinish: ['ver', 'nor', 'pia', 'lec', 'rus', 'ant', 'ham', 'had', 'alb', 'bea'],
    gpQualifying: ['ver', null, null],
    fastestLap: 'ant',
  },
  'bhr_25': {
    grandPrixFinish: ['pia', 'rus', 'nor', 'lec', 'ham', 'ver', 'gas', 'oco', 'tsu', 'bea'],
    gpQualifying: ['pia', null, null],
    fastestLap: 'pia',
  },
  'sau_25': {
    grandPrixFinish: ['pia', 'ver', 'lec', 'nor', 'rus', 'ant', 'ham', 'sai', 'alb', 'had'],
    gpQualifying: ['ver', null, null],
    fastestLap: 'nor',
  },
  'mia_25': {
    grandPrixFinish: ['pia', 'nor', 'rus', 'ver', 'alb', 'ant', 'lec', 'ham', 'sai', 'tsu'],
    sprintFinish: ['nor', 'pia', 'ham', 'rus', 'str', 'tsu', 'ant', 'gas'],
    gpQualifying: ['ver', null, null],
    fastestLap: 'nor',
  },
  'emi_25': {
    grandPrixFinish: ['ver', 'nor', 'pia', 'ham', 'alb', 'lec', 'rus', 'sai', 'had', 'tsu'],
    gpQualifying: ['pia', null, null],
    fastestLap: 'ver',
  },
  'mco_25': {
    grandPrixFinish: ['nor', 'lec', 'pia', 'ver', 'ham', 'had', 'oco', 'law', 'alb', 'sai'],
    gpQualifying: ['nor', null, null],
    fastestLap: 'ham',
  },
  'esp_25': {
    grandPrixFinish: ['pia', 'nor', 'lec', 'rus', 'hul', 'ham', 'had', 'gas', 'alo', 'ver'],
    gpQualifying: ['pia', null, null],
    fastestLap: 'pia',
  },
  'can_25': {
    grandPrixFinish: ['rus', 'ver', 'ant', 'pia', 'lec', 'ham', 'alo', 'hul', 'oco', 'sai'],
    gpQualifying: ['rus', null, null],
    fastestLap: 'rus',
  },
  'aut_25': {
    grandPrixFinish: ['nor', 'pia', 'lec', 'ham', 'rus', 'law', 'alo', 'bor', 'hul', 'oco'],
    gpQualifying: ['nor', null, null],
    fastestLap: 'pia',
  },
  'gbr_25': {
    grandPrixFinish: ['nor', 'pia', 'hul', 'ham', 'ver', 'gas', 'str', 'alb', 'alo', 'rus'],
    gpQualifying: ['ver', null, null],
    fastestLap: 'pia',
  },
  'bel_25': {
    grandPrixFinish: ['pia', 'nor', 'lec', 'ver', 'rus', 'alb', 'ham', 'law', 'bor', 'gas'],
    sprintFinish: ['ver', 'pia', 'nor', 'lec', 'oco', 'sai', 'bea', 'had'],
    gpQualifying: ['nor', null, null],
    fastestLap: 'ant',
  },
  'hun_25': {
    grandPrixFinish: ['nor', 'pia', 'rus', 'lec', 'alo', 'bor', 'str', 'law', 'ver', 'ant'],
    gpQualifying: ['lec', null, null],
    fastestLap: 'rus',
  },
  'nld_25': {
    grandPrixFinish: ['pia', 'ver', 'had', 'rus', 'alb', 'bea', 'str', 'alo', 'tsu', 'oco'],
    gpQualifying: ['pia', null, null],
    fastestLap: 'pia',
  },
  'ita_25': {
    grandPrixFinish: ['ver', 'nor', 'pia', 'lec', 'rus', 'ham', 'alb', 'bor', 'ant', 'had'],
    gpQualifying: ['ver', null, null],
    fastestLap: 'nor',
  },
  'aze_25': {
    grandPrixFinish: ['ver', 'rus', 'sai', 'ant', 'law', 'tsu', 'nor', 'ham', 'lec', 'had'],
    gpQualifying: ['ver', null, null],
    fastestLap: 'ver',
  },
  'sgp_25': {
    grandPrixFinish: ['rus', 'ver', 'nor', 'pia', 'ant', 'lec', 'alo', 'ham', 'bea', 'sai'],
    gpQualifying: ['rus', null, null],
    fastestLap: 'ham',
  },
  'usa_25': {
    grandPrixFinish: ['ver', 'nor', 'lec', 'ham', 'pia', 'rus', 'tsu', 'hul', 'bea', 'alo'],
    sprintFinish: ['ver', 'rus', 'sai', 'ham', 'lec', 'alb', 'tsu', 'ant'],
    gpQualifying: ['ver', null, null],
    fastestLap: 'ant',
  },
  'mex_25': {
    grandPrixFinish: ['nor', 'lec', 'ver', 'bea', 'pia', 'ant', 'rus', 'ham', 'oco', 'bor'],
    gpQualifying: ['nor', null, null],
    fastestLap: 'rus',
  },
  'bra_25': {
    grandPrixFinish: [],
    sprintFinish: ['nor', 'ant', 'rus', 'ver', 'lec', 'alo', 'ham', 'gas'],
    gpQualifying: [],
    // Fix: Add missing 'fastestLap' property to conform to the EventResult type.
    fastestLap: null,
  },
};

export let MOCK_USERS: User[] = [
    { id: 'user-001', displayName: 'Guy Mouton', email: 'ggmouton@gmail.com' },
    { id: 'user-002', displayName: 'Jonathan Cummi', email: 'jonathan.cummin@hotmail.com' },
    { id: 'user-003', displayName: 'Tony Androsky', email: 'tony0035@hotmail.com' },
    { id: 'user-004', displayName: 'Mike Merritt', email: 'mmerritt638@gmail.com' },
    { id: 'user-005', displayName: 'Chris Johnson', email: 'johnson.christoph@gmail.com' },
    { id: 'user-006', displayName: 'Bernie McSpeed', email: 'speedbird977@gmail.com' },
    { id: 'user-007', displayName: 'Phil Root', email: 'philroot11@gmail.com' },
    { id: 'user-008', displayName: 'Daniel George', email: 'daniel.georges@gmail.com' },
    { id: 'user-009', displayName: 'Ed Bryant', email: 'ebryant11@gmail.com' },
    { id: 'user-010', displayName: 'Chris DeLizza', email: 'chris@cdelizza.com' },
    { id: 'user-011', displayName: 'Kurt Mouton', email: 'kgmouton@gmail.com' },
    { id: 'user-012', displayName: 'Spencer McKenna', email: 'spencermckenna@gmail.com' },
    { id: 'user-013', displayName: 'Bob DeLizza', email: 'Bobd@electrcsa.com' },
    { id: 'user-014', displayName: 'Mark Corley', email: 'mark_corley@hotmail.com' },
    { id: 'user-015', displayName: 'Jim Baltimore', email: 'skunkpress@gmail.com' },
    { id: 'user-016', displayName: 'Jeff Sexton', email: 'jsexton81@rocketmail.com' },
    { id: 'user-017', displayName: 'Jamal Thomas', email: 'jamal.thomas@gmail.com' },
    { id: 'user-018', displayName: 'John Houser', email: 'jhouser1988@gmail.com' },
    { id: 'user-019', displayName: 'Shaq Tensley', email: 'shaqtensley@gmail.com' },
    { id: 'user-020', displayName: 'William Jones', email: 'jonesw55@aol.com' },
    { id: 'user-021', displayName: 'Carsten Bick', email: 'bick.carsten@gmail.com' },
    { id: 'user-022', displayName: 'Jay McKenna', email: 'johnmckenna@j.com' },
    { id: 'user-023', displayName: 'Nick Sexton', email: 'nrsexton94@gmail.com' },
    { id: 'user-024', displayName: 'David Taylor', email: 'royalt17@yahoo.com' },
    { id: 'user-025', displayName: 'Cully', email: 'jmmccully@gmail.com' },
    { id: 'user-admin', displayName: 'Admin Principal', email: 'admin@fantasy.f1' },
];

export let MOCK_SEASON_PICKS: { [userId: string]: { [eventId: string]: PickSelection } } = {
  "user-001": {
    "aus_25": { "aTeams": ["red_bull", "ferrari"], "bTeam": "haas", "aDrivers": ["ver", "lec", "ham"], "bDrivers": ["oco", "bea"], "fastestLap": "ver" },
    "chn_25": { "aTeams": ["mclaren", "mercedes"], "bTeam": "racing_bulls", "aDrivers": ["nor", "rus", "ant"], "bDrivers": ["had", "law"], "fastestLap": "nor" }
  },
  "user-002": {
    "aus_25": { "aTeams": ["mclaren", "williams"], "bTeam": "aston_martin", "aDrivers": ["pia", "nor", "alb"], "bDrivers": ["alo", "str"], "fastestLap": "pia" },
    "chn_25": { "aTeams": ["ferrari", "red_bull"], "bTeam": "alpine", "aDrivers": ["lec", "ham", "tsu"], "bDrivers": ["gas"], "fastestLap": "lec" },
    "jpn_25": { "aTeams": ["mercedes", "red_bull"], "bTeam": "kick_sauber", "aDrivers": ["rus", "ant", "ver"], "bDrivers": ["hul", "bor"], "fastestLap": "rus" }
  },
  "user-003": {
    "aus_25": { "aTeams": ["ferrari", "mercedes"], "bTeam": "racing_bulls", "aDrivers": ["lec", "rus", "ant"], "bDrivers": ["had", "law"], "fastestLap": "rus" },
    "chn_25": { "aTeams": ["red_bull", "mclaren"], "bTeam": "haas", "aDrivers": ["ver", "tsu", "nor"], "bDrivers": ["oco", "bea"], "fastestLap": "ver" },
    "bhr_25": { "aTeams": ["ferrari", "mclaren"], "bTeam": "aston_martin", "aDrivers": ["ham", "lec", "pia"], "bDrivers": ["alo", "str"], "fastestLap": "ham" }
  },
   "user-005": {
    "aus_25": { "aTeams": ["red_bull", "mclaren"], "bTeam": "kick_sauber", "aDrivers": ["ver", "nor", "pia"], "bDrivers": ["hul", "bor"], "fastestLap": "ver" },
    "chn_25": { "aTeams": ["ferrari", "williams"], "bTeam": "haas", "aDrivers": ["lec", "ham", "alb"], "bDrivers": ["oco", "bea"], "fastestLap": "lec" },
    "jpn_25": { "aTeams": ["mercedes", "ferrari"], "bTeam": "racing_bulls", "aDrivers": ["rus", "ant", "lec"], "bDrivers": ["had", "law"], "fastestLap": "rus" },
    "bhr_25": { "aTeams": ["red_bull", "mercedes"], "bTeam": "aston_martin", "aDrivers": ["ver", "tsu", "rus"], "bDrivers": ["alo", "str"], "fastestLap": "ver" }
  },
  "user-admin": {
    "aus_25": { "aTeams": ["ferrari", "red_bull"], "bTeam": "racing_bulls", "aDrivers": ["ver", "lec", "ham"], "bDrivers": ["had", "law"], "fastestLap": "ver" },
    "chn_25": { "aTeams": ["mclaren", "ferrari"], "bTeam": "haas", "aDrivers": ["nor", "lec", "pia"], "bDrivers": ["oco", "bea"], "fastestLap": "nor" }
  }
};