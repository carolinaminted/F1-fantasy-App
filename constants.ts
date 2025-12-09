
// Fix: Add a detailed points system and mock race results to enable dynamic scoring calculations.
import { Constructor, Driver, EntityClass, Event, PickSelection, User, RaceResults, PointsSystem } from './types.ts';

export const LEAGUE_DUES_AMOUNT = 25; // in USD
export const CURRENT_SEASON = '2026';
export const PAYPAL_DONATION_URL = 'https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jhouser1988%40gmail.com&item_name=F1+Fantasy+League+Operational+Costs&currency_code=USD';
export const PAYPAL_PAY_DUES_URL = 'https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jhouser1988%40gmail.com&item_name=Formula+Fantasy+One+Pay+Dues&currency_code=USD';


export const CONSTRUCTORS: Constructor[] = [
  // Class A
  { id: 'ferrari', name: 'Ferrari', class: EntityClass.A, isActive: true },
  { id: 'mclaren', name: 'McLaren', class: EntityClass.A, isActive: true },
  { id: 'red_bull', name: 'Red Bull Racing', class: EntityClass.A, isActive: true },
  { id: 'mercedes', name: 'Mercedes', class: EntityClass.A, isActive: true },
  { id: 'williams', name: 'Williams', class: EntityClass.A, isActive: true }, // Promoted to A
  // Class B
  { id: 'aston_martin', name: 'Aston Martin', class: EntityClass.B, isActive: true }, // Demoted to B
  { id: 'audi', name: 'Audi F1 Team', class: EntityClass.B, isActive: true }, // Rebrand from Sauber
  { id: 'alpine', name: 'Alpine', class: EntityClass.B, isActive: true },
  { id: 'racing_bulls', name: 'Racing Bulls', class: EntityClass.B, isActive: true },
  { id: 'haas', name: 'Haas F1 Team', class: EntityClass.B, isActive: true },
  { id: 'cadillac', name: 'Cadillac F1 Team', class: EntityClass.B, isActive: true }, // New Team
];

export const DRIVERS: Driver[] = [
  // Ferrari (A)
  { id: 'lec', name: 'Charles Leclerc', constructorId: 'ferrari', class: EntityClass.A, isActive: true },
  { id: 'ham', name: 'Lewis Hamilton', constructorId: 'ferrari', class: EntityClass.A, isActive: true },
  // McLaren (A)
  { id: 'nor', name: 'Lando Norris', constructorId: 'mclaren', class: EntityClass.A, isActive: true },
  { id: 'pia', name: 'Oscar Piastri', constructorId: 'mclaren', class: EntityClass.A, isActive: true },
  // Red Bull (A)
  { id: 'ver', name: 'Max Verstappen', constructorId: 'red_bull', class: EntityClass.A, isActive: true },
  { id: 'law', name: 'Liam Lawson', constructorId: 'red_bull', class: EntityClass.A, isActive: true },
  // Mercedes (A)
  { id: 'rus', name: 'George Russell', constructorId: 'mercedes', class: EntityClass.A, isActive: true },
  { id: 'ant', name: 'Andrea Kimi Antonelli', constructorId: 'mercedes', class: EntityClass.A, isActive: true },
  // Williams (A)
  { id: 'alb', name: 'Alexander Albon', constructorId: 'williams', class: EntityClass.A, isActive: true },
  { id: 'sai', name: 'Carlos Sainz Jr.', constructorId: 'williams', class: EntityClass.A, isActive: true },
  // Aston Martin (B)
  { id: 'alo', name: 'Fernando Alonso', constructorId: 'aston_martin', class: EntityClass.B, isActive: true },
  { id: 'str', name: 'Lance Stroll', constructorId: 'aston_martin', class: EntityClass.B, isActive: true },
  // Audi (B)
  { id: 'hul', name: 'Nico Hulkenberg', constructorId: 'audi', class: EntityClass.B, isActive: true },
  { id: 'bor', name: 'Gabriel Bortoleto', constructorId: 'audi', class: EntityClass.B, isActive: true },
  // Alpine (B)
  { id: 'gas', name: 'Pierre Gasly', constructorId: 'alpine', class: EntityClass.B, isActive: true },
  { id: 'doo', name: 'Jack Doohan', constructorId: 'alpine', class: EntityClass.B, isActive: true },
  // Racing Bulls (B)
  { id: 'tsu', name: 'Yuki Tsunoda', constructorId: 'racing_bulls', class: EntityClass.B, isActive: true },
  { id: 'had', name: 'Isack Hadjar', constructorId: 'racing_bulls', class: EntityClass.B, isActive: true },
  // Haas (B)
  { id: 'oco', name: 'Esteban Ocon', constructorId: 'haas', class: EntityClass.B, isActive: true },
  { id: 'bea', name: 'Oliver Bearman', constructorId: 'haas', class: EntityClass.B, isActive: true },
  // Cadillac (B)
  { id: 'her', name: 'Colton Herta', constructorId: 'cadillac', class: EntityClass.B, isActive: true },
  { id: 'pow', name: 'Pato O\'Ward', constructorId: 'cadillac', class: EntityClass.B, isActive: true },
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
    { id: 'aus_26', round: 1, name: 'Australian GP', country: 'Australia', hasSprint: false, ...createEventDate('2026-03-15') },
    { id: 'chn_26', round: 2, name: 'Chinese GP', country: 'China', hasSprint: true, ...createEventDate('2026-03-29') },
    { id: 'jpn_26', round: 3, name: 'Japanese GP', country: 'Japan', hasSprint: false, ...createEventDate('2026-04-12') },
    { id: 'bhr_26', round: 4, name: 'Bahrain GP', country: 'Bahrain', hasSprint: false, ...createEventDate('2026-04-19') },
    { id: 'sau_26', round: 5, name: 'Saudi Arabian GP', country: 'Saudi Arabia', hasSprint: false, ...createEventDate('2026-04-26') },
    { id: 'mia_26', round: 6, name: 'Miami GP', country: 'USA', hasSprint: true, ...createEventDate('2026-05-03') },
    { id: 'emi_26', round: 7, name: 'Emilia-Romagna GP', country: 'Italy', hasSprint: false, ...createEventDate('2026-05-17') },
    { id: 'mco_26', round: 8, name: 'Monaco GP', country: 'Monaco', hasSprint: false, ...createEventDate('2026-05-24') },
    { id: 'esp_26', round: 9, name: 'Spanish GP', country: 'Spain', hasSprint: false, ...createEventDate('2026-06-07') },
    { id: 'can_26', round: 10, name: 'Canadian GP', country: 'Canada', hasSprint: false, ...createEventDate('2026-06-21') },
    { id: 'aut_26', round: 11, name: 'Austrian GP', country: 'Austria', hasSprint: false, ...createEventDate('2026-06-28') },
    { id: 'gbr_26', round: 12, name: 'British GP', country: 'Great Britain', hasSprint: false, ...createEventDate('2026-07-12') },
    { id: 'bel_26', round: 13, name: 'Belgian GP', country: 'Belgium', hasSprint: true, ...createEventDate('2026-07-26') },
    { id: 'hun_26', round: 14, name: 'Hungarian GP', country: 'Hungary', hasSprint: false, ...createEventDate('2026-08-02') },
    { id: 'nld_26', round: 15, name: 'Dutch GP', country: 'Netherlands', hasSprint: false, ...createEventDate('2026-08-30') },
    { id: 'ita_26', round: 16, name: 'Italian GP', country: 'Italy', hasSprint: false, ...createEventDate('2026-09-06') },
    { id: 'aze_26', round: 17, name: 'Azerbaijan GP', country: 'Azerbaijan', hasSprint: false, ...createEventDate('2026-09-20') },
    { id: 'sgp_26', round: 18, name: 'Singapore GP', country: 'Singapore', hasSprint: false, ...createEventDate('2026-10-04') },
    { id: 'usa_26', round: 19, name: 'United States GP', country: 'USA', hasSprint: true, ...createEventDate('2026-10-18') },
    { id: 'mex_26', round: 20, name: 'Mexico City GP', country: 'Mexico', hasSprint: false, ...createEventDate('2026-10-25') },
    { id: 'bra_26', round: 21, name: 'Sao Paulo GP', country: 'Brazil', hasSprint: true, ...createEventDate('2026-11-08') },
    { id: 'las_26', round: 22, name: 'Las Vegas GP', country: 'USA', hasSprint: false, ...createEventDate('2026-11-21') },
    { id: 'qat_26', round: 23, name: 'Qatar GP', country: 'Qatar', hasSprint: true, ...createEventDate('2026-11-29') },
    { id: 'abu_26', round: 24, name: 'Abu Dhabi GP', country: 'Abu Dhabi', hasSprint: false, ...createEventDate('2026-12-06') },
];


export const USAGE_LIMITS = {
  [EntityClass.A]: { teams: 10, drivers: 8 },
  [EntityClass.B]: { teams: 5, drivers: 5 },
};

export const DEFAULT_POINTS_SYSTEM: PointsSystem = {
  grandPrixFinish: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  sprintFinish: [8, 7, 6, 5, 4, 3, 2, 1],
  fastestLap: 3,
  gpQualifying: [3, 2, 1],
  sprintQualifying: [3, 2, 1],
};

export let RACE_RESULTS: RaceResults = {};

export let MOCK_USERS: User[] = [
    { id: 'user-admin', displayName: 'Admin Principal', email: 'admin@fantasy.f1' },
];

export let MOCK_SEASON_PICKS: { [userId: string]: { [eventId: string]: PickSelection } } = {};
