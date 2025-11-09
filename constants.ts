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
    { id: 'aus_26', round: 1, name: 'Australian GP', country: 'Australia', hasSprint: false, ...generateEventDate(baseDate, -7 * 4) },
    { id: 'chn_26', round: 2, name: 'Chinese GP', country: 'China', hasSprint: true, ...generateEventDate(baseDate, -7 * 3) },
    { id: 'jpn_26', round: 3, name: 'Japanese GP', country: 'Japan', hasSprint: false, ...generateEventDate(baseDate, -7 * 2) },
    { id: 'bhr_26', round: 4, name: 'Bahrain GP', country: 'Bahrain', hasSprint: false, ...generateEventDate(baseDate, -7 * 1) },
    { id: 'sau_26', round: 5, name: 'Saudi Arabian GP', country: 'Saudi Arabia', hasSprint: false, ...generateEventDate(baseDate, 7 * 1) },
    { id: 'mia_26', round: 6, name: 'Miami GP', country: 'USA', hasSprint: true, ...generateEventDate(baseDate, 7 * 2) },
    { id: 'emi_26', round: 7, name: 'Emilia-Romagna GP', country: 'Italy', hasSprint: false, ...generateEventDate(baseDate, 7 * 3) },
    { id: 'mco_26', round: 8, name: 'Monaco GP', country: 'Monaco', hasSprint: false, ...generateEventDate(baseDate, 7 * 4) },
    { id: 'can_26', round: 9, name: 'Canadian GP', country: 'Canada', hasSprint: true, ...generateEventDate(baseDate, 7 * 5) },
    { id: 'esp_26', round: 10, name: 'Spanish GP', country: 'Spain', hasSprint: false, ...generateEventDate(baseDate, 7 * 6) },
    { id: 'aut_26', round: 11, name: 'Austrian GP', country: 'Austria', hasSprint: false, ...generateEventDate(baseDate, 7 * 7) },
    { id: 'gbr_26', round: 12, name: 'British GP', country: 'Great Britain', hasSprint: true, ...generateEventDate(baseDate, 7 * 8) },
    { id: 'bel_26', round: 13, name: 'Belgian GP', country: 'Belgium', hasSprint: false, ...generateEventDate(baseDate, 7 * 9) },
    { id: 'hun_26', round: 14, name: 'Hungarian GP', country: 'Hungary', hasSprint: false, ...generateEventDate(baseDate, 7 * 10) },
    { id: 'nld_26', round: 15, name: 'Dutch GP', country: 'Netherlands', hasSprint: true, ...generateEventDate(baseDate, 7 * 11) },
    { id: 'ita_26', round: 16, name: 'Italian GP', country: 'Italy', hasSprint: false, ...generateEventDate(baseDate, 7 * 12) },
    { id: 'aze_26', round: 17, name: 'Azerbaijan GP', country: 'Azerbaijan', hasSprint: false, ...generateEventDate(baseDate, 7 * 13) },
    { id: 'sgp_26', round: 18, name: 'Singapore GP', country: 'Singapore', hasSprint: true, ...generateEventDate(baseDate, 7 * 14) },
    { id: 'usa_26', round: 19, name: 'United States GP', country: 'USA', hasSprint: false, ...generateEventDate(baseDate, 7 * 15) },
    { id: 'mex_26', round: 20, name: 'Mexico City GP', country: 'Mexico', hasSprint: false, ...generateEventDate(baseDate, 7 * 16) },
    { id: 'bra_26', round: 21, name: 'Sao Paulo GP', country: 'Brazil', hasSprint: false, ...generateEventDate(baseDate, 7 * 17) },
    { id: 'las_26', round: 22, name: 'Las Vegas GP', country: 'USA', hasSprint: false, ...generateEventDate(baseDate, 7 * 18) },
    { id: 'qat_26', round: 23, name: 'Qatar GP', country: 'Qatar', hasSprint: false, ...generateEventDate(baseDate, 7 * 19) },
    { id: 'abu_26', round: 24, name: 'Abu Dhabi GP', country: 'Abu Dhabi', hasSprint: false, ...generateEventDate(baseDate, 7 * 20) },
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
  'bhr_26': {
    grandPrixFinish: ['sai', 'lec', 'ver', 'rus', 'nor', 'ham', 'pia', 'alo', 'str', 'zho'],
    gpQualifying: ['lec', 'ver', 'sai'],
    fastestLap: 'sai',
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
    "aus_26": { "aTeams": ["red_bull", "ferrari"], "bTeam": "haas", "aDrivers": ["ver", "lec", "sai"], "bDrivers": ["mag", "hul"], "fastestLap": "ver" },
    "chn_26": { "aTeams": ["mclaren", "mercedes"], "bTeam": "racing_bulls", "aDrivers": ["nor", "ham", "rus"], "bDrivers": ["ric", "tsu"], "fastestLap": "nor" }
  },
  "user-002": {
    "aus_26": { "aTeams": ["mclaren", "williams"], "bTeam": "aston_martin", "aDrivers": ["pia", "nor", "alb"], "bDrivers": ["alo", "str"], "fastestLap": "pia" },
    "chn_26": { "aTeams": ["ferrari", "red_bull"], "bTeam": "alpine", "aDrivers": ["lec", "sai", "per"], "bDrivers": ["gas", "oco"], "fastestLap": "lec" },
    "jpn_26": { "aTeams": ["mercedes", "red_bull"], "bTeam": "kick_sauber", "aDrivers": ["ham", "rus", "ver"], "bDrivers": ["bot", "zho"], "fastestLap": "ham" }
  },
  "user-003": {
    "aus_26": { "aTeams": ["ferrari", "mercedes"], "bTeam": "racing_bulls", "aDrivers": ["lec", "ham", "rus"], "bDrivers": ["ric", "tsu"], "fastestLap": "rus" },
    "chn_26": { "aTeams": ["red_bull", "mclaren"], "bTeam": "haas", "aDrivers": ["ver", "per", "nor"], "bDrivers": ["mag", "hul"], "fastestLap": "ver" },
    "bhr_26": { "aTeams": ["ferrari", "mclaren"], "bTeam": "cadillac", "aDrivers": ["sai", "lec", "pia"], "bDrivers": ["pal", "her"], "fastestLap": "sai" }
  },
  "user-004": {
    "jpn_26": { "aTeams": ["red_bull", "ferrari"], "bTeam": "aston_martin", "aDrivers": ["ver", "lec", "per"], "bDrivers": ["alo", "str"], "fastestLap": "per" },
    "bhr_26": { "aTeams": ["mclaren", "mercedes"], "bTeam": "alpine", "aDrivers": ["nor", "pia", "ham"], "bDrivers": ["gas", "oco"], "fastestLap": "nor" }
  },
  "user-005": {
    "aus_26": { "aTeams": ["red_bull", "mclaren"], "bTeam": "kick_sauber", "aDrivers": ["ver", "nor", "pia"], "bDrivers": ["bot", "zho"], "fastestLap": "ver" },
    "chn_26": { "aTeams": ["ferrari", "williams"], "bTeam": "haas", "aDrivers": ["lec", "sai", "alb"], "bDrivers": ["mag", "hul"], "fastestLap": "lec" },
    "jpn_26": { "aTeams": ["mercedes", "ferrari"], "bTeam": "racing_bulls", "aDrivers": ["ham", "rus", "lec"], "bDrivers": ["ric", "tsu"], "fastestLap": "rus" },
    "bhr_26": { "aTeams": ["red_bull", "mercedes"], "bTeam": "aston_martin", "aDrivers": ["ver", "per", "ham"], "bDrivers": ["alo", "str"], "fastestLap": "ver" }
  },
  "user-006": {
    "chn_26": { "aTeams": ["mclaren", "ferrari"], "bTeam": "alpine", "aDrivers": ["nor", "lec", "sai"], "bDrivers": ["gas", "oco"], "fastestLap": "nor" },
    "jpn_26": { "aTeams": ["red_bull", "williams"], "bTeam": "cadillac", "aDrivers": ["ver", "per", "alb"], "bDrivers": ["pal", "her"], "fastestLap": "ver" }
  },
  "user-007": {
    "aus_26": { "aTeams": ["mercedes", "red_bull"], "bTeam": "haas", "aDrivers": ["ham", "rus", "ver"], "bDrivers": ["mag", "hul"], "fastestLap": "ham" },
    "chn_26": { "aTeams": ["ferrari", "mclaren"], "bTeam": "aston_martin", "aDrivers": ["lec", "nor", "pia"], "bDrivers": ["alo", "str"], "fastestLap": "lec" },
    "jpn_26": { "aTeams": ["red_bull", "mercedes"], "bTeam": "racing_bulls", "aDrivers": ["ver", "ham", "rus"], "bDrivers": ["ric", "tsu"], "fastestLap": "ver" }
  },
  "user-008": {
    "aus_26": { "aTeams": ["williams", "ferrari"], "bTeam": "kick_sauber", "aDrivers": ["alb", "sar", "lec"], "bDrivers": ["bot", "zho"], "fastestLap": "lec" },
    "bhr_26": { "aTeams": ["mclaren", "red_bull"], "bTeam": "haas", "aDrivers": ["nor", "pia", "ver"], "bDrivers": ["mag", "hul"], "fastestLap": "nor" }
  },
  "user-009": {
    "aus_26": { "aTeams": ["ferrari", "red_bull"], "bTeam": "alpine", "aDrivers": ["lec", "sai", "ver"], "bDrivers": ["gas", "oco"], "fastestLap": "ver" },
    "chn_26": { "aTeams": ["mclaren", "mercedes"], "bTeam": "aston_martin", "aDrivers": ["nor", "pia", "ham"], "bDrivers": ["alo", "str"], "fastestLap": "pia" },
    "jpn_26": { "aTeams": ["red_bull", "ferrari"], "bTeam": "haas", "aDrivers": ["ver", "per", "lec"], "bDrivers": ["mag", "hul"], "fastestLap": "ver" }
  },
  "user-010": {
    "chn_26": { "aTeams": ["mercedes", "williams"], "bTeam": "racing_bulls", "aDrivers": ["ham", "rus", "alb"], "bDrivers": ["ric", "tsu"], "fastestLap": "ham" },
    "bhr_26": { "aTeams": ["ferrari", "red_bull"], "bTeam": "kick_sauber", "aDrivers": ["lec", "sai", "ver"], "bDrivers": ["bot", "zho"], "fastestLap": "lec" }
  },
  "user-011": {
    "aus_26": { "aTeams": ["mclaren", "mercedes"], "bTeam": "cadillac", "aDrivers": ["nor", "pia", "rus"], "bDrivers": ["pal", "her"], "fastestLap": "nor" },
    "chn_26": { "aTeams": ["red_bull", "ferrari"], "bTeam": "alpine", "aDrivers": ["ver", "lec", "sai"], "bDrivers": ["gas", "oco"], "fastestLap": "ver" }
  },
  "user-012": {
    "jpn_26": { "aTeams": ["ferrari", "mclaren"], "bTeam": "haas", "aDrivers": ["lec", "sai", "nor"], "bDrivers": ["mag", "hul"], "fastestLap": "sai" },
    "bhr_26": { "aTeams": ["red_bull", "williams"], "bTeam": "aston_martin", "aDrivers": ["ver", "per", "alb"], "bDrivers": ["alo", "str"], "fastestLap": "ver" }
  },
  "user-013": {
    "aus_26": { "aTeams": ["red_bull", "mercedes"], "bTeam": "racing_bulls", "aDrivers": ["ver", "ham", "rus"], "bDrivers": ["tsu", "ric"], "fastestLap": "ham" }
  },
  "user-014": {
    "chn_26": { "aTeams": ["ferrari", "mclaren"], "bTeam": "kick_sauber", "aDrivers": ["lec", "nor", "sai"], "bDrivers": ["bot", "zho"], "fastestLap": "nor" },
    "jpn_26": { "aTeams": ["red_bull", "mercedes"], "bTeam": "alpine", "aDrivers": ["ver", "per", "ham"], "bDrivers": ["gas", "oco"], "fastestLap": "ver" }
  },
  "user-015": {
    "aus_26": { "aTeams": ["mclaren", "ferrari"], "bTeam": "haas", "aDrivers": ["nor", "pia", "lec"], "bDrivers": ["mag", "hul"], "fastestLap": "lec" },
    "chn_26": { "aTeams": ["red_bull", "mercedes"], "bTeam": "aston_martin", "aDrivers": ["ver", "ham", "rus"], "bDrivers": ["alo", "str"], "fastestLap": "rus" },
    "bhr_26": { "aTeams": ["ferrari", "williams"], "bTeam": "racing_bulls", "aDrivers": ["sai", "lec", "alb"], "bDrivers": ["ric", "tsu"], "fastestLap": "sai" }
  },
  "user-016": {
    "aus_26": { "aTeams": ["ferrari", "williams"], "bTeam": "cadillac", "aDrivers": ["lec", "sai", "alb"], "bDrivers": ["pal", "her"], "fastestLap": "lec" },
    "jpn_26": { "aTeams": ["mclaren", "red_bull"], "bTeam": "kick_sauber", "aDrivers": ["nor", "pia", "ver"], "bDrivers": ["bot", "zho"], "fastestLap": "ver" }
  },
  "user-017": {
    "chn_26": { "aTeams": ["red_bull", "mercedes"], "bTeam": "haas", "aDrivers": ["ver", "ham", "rus"], "bDrivers": ["mag", "hul"], "fastestLap": "ham" },
    "bhr_26": { "aTeams": ["ferrari", "mclaren"], "bTeam": "alpine", "aDrivers": ["lec", "sai", "nor"], "bDrivers": ["gas", "oco"], "fastestLap": "lec" }
  },
  "user-018": {
    "aus_26": { "aTeams": ["mclaren", "red_bull"], "bTeam": "racing_bulls", "aDrivers": ["nor", "ver", "per"], "bDrivers": ["ric", "tsu"], "fastestLap": "nor" },
    "jpn_26": { "aTeams": ["ferrari", "mercedes"], "bTeam": "aston_martin", "aDrivers": ["lec", "sai", "ham"], "bDrivers": ["alo", "str"], "fastestLap": "sai" }
  },
  "user-019": {
    "aus_26": { "aTeams": ["red_bull", "ferrari"], "bTeam": "kick_sauber", "aDrivers": ["ver", "lec", "sai"], "bDrivers": ["bot", "zho"], "fastestLap": "ver" },
    "chn_26": { "aTeams": ["mclaren", "williams"], "bTeam": "haas", "aDrivers": ["nor", "pia", "alb"], "bDrivers": ["mag", "hul"], "fastestLap": "pia" }
  },
  "user-020": {
    "chn_26": { "aTeams": ["ferrari", "mercedes"], "bTeam": "cadillac", "aDrivers": ["lec", "sai", "ham"], "bDrivers": ["pal", "her"], "fastestLap": "lec" },
    "bhr_26": { "aTeams": ["red_bull", "mclaren"], "bTeam": "racing_bulls", "aDrivers": ["ver", "per", "nor"], "bDrivers": ["ric", "tsu"], "fastestLap": "ver" }
  },
  "user-admin": {
    "aus_26": { "aTeams": ["ferrari", "red_bull"], "bTeam": "racing_bulls", "aDrivers": ["ver", "lec", "sai"], "bDrivers": ["ric", "tsu"], "fastestLap": "ver" },
    "chn_26": { "aTeams": ["mclaren", "ferrari"], "bTeam": "haas", "aDrivers": ["nor", "lec", "pia"], "bDrivers": ["mag", "hul"], "fastestLap": "nor" }
  }
};