# 🏎️ Lights Out League — F1 Fantasy Platform

> *"It's lights out and away we go!"*

A premium Formula 1 fantasy league platform built for competitive play across a full 24-race season. Players assemble teams of drivers and constructors each race weekend, earn points based on real-world F1 results, and battle for the championship across the season.

Built as a solo-developer project to replace a legacy Google Forms + Spreadsheet workflow for a 40-person private league.

---

## Live Demo

**Production:** Deployed on Google Cloud Run via Firebase Hosting

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Firebase Setup](#firebase-setup)
- [Firestore Data Model](#firestore-data-model)
- [Scoring System](#scoring-system)
- [Design System](#design-system)
- [Cloud Functions](#cloud-functions)
- [Admin Panel](#admin-panel)
- [Architecture Decisions](#architecture-decisions)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Lights Out League handles the full lifecycle of an F1 fantasy season:

1. **Pre-Race** — Players submit driver/team picks before qualifying lock deadlines with countdown timers
2. **Race Weekend** — Admin enters real-world results; scoring engine calculates points automatically
3. **Post-Race** — Leaderboard updates, users review breakdowns, popular picks trend data refreshes
4. **Season-Long** — Usage limits enforce strategic depth across 24 races; standings track the championship battle

The platform supports 40 concurrent users during the critical 2-hour pre-race pick window.

---

## Features

### Player-Facing
- **GP Picks Form** — Select 2 Class A teams, 1 Class B team, 3 Class A drivers, 2 Class B drivers, and a fastest lap prediction per race
- **Usage Tracking** — Real-time counters showing how many times each entity has been used vs. season limits (Class A: 10 teams / 8 drivers, Class B: 5/5)
- **Countdown Timers** — Live countdown to pick lock deadlines with soft deadline warnings
- **Profile & History** — Season-long pick history with per-event scoring breakdowns and usage meters
- **Leaderboard Hub** — Full standings, popular picks analysis, category insights (GP / Quali / Sprint / Fastest Lap), and real-world entity performance stats
- **GP Results** — View official race results as entered by the admin, with full finishing order and qualifying results
- **Drivers & Teams** — Browse all active drivers and constructors, organized by class with team branding colors
- **Scoring Transparency** — Full breakdown of the points system so players can strategize
- **Donation & Dues** — Integrated payment initiation for league dues

### Admin Panel
- **Results Manager** — Enter GP finish, qualifying, sprint, and fastest lap results per event with driver-team snapshot preservation
- **Form Lock Controls** — Manual override to lock/unlock pick submission per event (overrides schedule-based locking)
- **User Management** — View all league members, manage dues payment status, apply pick penalties
- **Scoring Profiles** — Create and switch between multiple scoring configurations
- **Entity Management** — Add/edit/deactivate drivers and constructors mid-season (handles transfers)
- **Schedule Manager** — Override session times, toggle sprint weekends, set custom lock deadlines
- **Invitation System** — Generate, reserve, and manage invite codes for controlled league access
- **Database Tools** — Manual leaderboard sync trigger and data management
- **Maintenance Mode** — F1-themed "Red Flag" maintenance screen that blocks all user access during admin operations

### Platform
- **Mobile-First** — Responsive design optimized for phones with safe-area insets for notch/home indicator
- **Real-Time Sync** — Firestore `onSnapshot` listeners for live data updates across all connected clients
- **Session Security** — Idle timeout with warning modal and automatic logout
- **Error Boundaries** — "Safety Car" fallback UI prevents full app crashes
- **Toast Notifications** — Non-blocking feedback for all async operations

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript |
| **Transpilation** | Babel Standalone (browser-side, via import maps) |
| **Styling** | Tailwind CSS with custom design tokens |
| **Backend** | Firebase (Auth, Firestore, Cloud Functions) |
| **Hosting** | Google Cloud Run / Firebase Hosting |
| **State Management** | React Hooks + Firestore real-time listeners |
| **Font** | Exo 2 (Google Fonts) |

### Key Dependency Note

This project uses **browser-side Babel transpilation** with ES module import maps — there is no build step. All dependencies are loaded via CDN:

```html
<script type="importmap">
{
  "imports": {
    "react": "https://aistudiocdn.com/react@^19.2.0",
    "@firebase/app": "https://aistudiocdn.com/@firebase/app@^0.14.5",
    "@firebase/auth": "https://aistudiocdn.com/@firebase/auth@^1.11.1",
    "@firebase/firestore": "https://aistudiocdn.com/@firebase/firestore@^4.9.2",
    ...
  }
}
</script>
```

No `npm install` required for the frontend. Cloud Functions have their own `package.json`.

---

## Project Structure

```
├── index.html                  # Entry point with import maps + Tailwind config
├── index.tsx                   # React root mount
├── App.tsx                     # Main app shell, routing, auth state, real-time listeners
├── firebaseConfig.ts           # Firebase project configuration
├── constants.ts                # Season data: EVENTS, DRIVERS, CONSTRUCTORS, USAGE_LIMITS, DEFAULT_POINTS_SYSTEM
├── types.ts                    # All TypeScript interfaces (single source of truth)
│
├── services/
│   ├── firebase.ts             # Firebase SDK initialization
│   ├── firestoreService.ts     # ALL database operations (no raw queries in UI)
│   ├── scoringService.ts       # Pure scoring/points calculation logic
│   └── simulationService.ts    # Scoring engine stress-test simulation
│
├── hooks/
│   └── useFantasyData.ts       # Derived fantasy data: sorted entities, usage rollups, score rollups
│
├── components/
│   ├── AuthScreen.tsx           # Login / Sign-up with email verification flow
│   ├── Dashboard.tsx            # Home dashboard with picks CTA + standings preview
│   ├── HomePage.tsx             # Event selector + PicksForm wrapper
│   ├── PicksForm.tsx            # Core pick submission form with usage counters
│   ├── SelectorGroup.tsx        # Reusable entity selector grid component
│   ├── ProfilePage.tsx          # User profile, pick history, scoring breakdowns
│   ├── LeaderboardPage.tsx      # Standings, popular picks, insights, entity stats
│   ├── GpResultsPage.tsx        # Official race results viewer
│   ├── DriversTeamsPage.tsx     # Driver/constructor browser by class
│   ├── PointsTransparency.tsx   # Scoring system reference
│   ├── DonationPage.tsx         # Donation interface
│   ├── DuesPaymentPage.tsx      # League dues payment initiation
│   ├── AdminPage.tsx            # Admin dashboard hub
│   ├── ResultsManagerPage.tsx   # Race results entry form
│   ├── ManageUsersPage.tsx      # User management + penalty controls
│   ├── ManageEntitiesPage.tsx   # Driver/constructor CRUD
│   ├── ScoringSettingsPage.tsx  # Scoring profile management
│   └── icons/                   # SVG icon components (30+)
│
├── functions/
│   ├── index.js                 # Cloud Functions: email verification, leaderboard sync, scoring recalc
│   └── package.json             # Functions dependencies (firebase-admin, firebase-functions, nodemailer)
│
└── ROADMAP.md                   # Optimization roadmap
```

### Critical File Ownership Rules

| File | Responsibility | Rule |
|------|---------------|------|
| `services/firestoreService.ts` | All database operations | **No raw Firestore queries in UI components** |
| `services/scoringService.ts` | Pure scoring calculations | No side effects, no DB calls |
| `constants.ts` | Season configuration | Single source for drivers, teams, events, usage limits |
| `types.ts` | TypeScript interfaces | Single source of truth for all types |

---

## Getting Started

### Prerequisites

- A Firebase project (Blaze plan recommended for Cloud Functions)
- Node.js 20+ (for Cloud Functions deployment)
- Firebase CLI: `npm install -g firebase-tools`

### Local Development

Since the frontend uses browser-side Babel transpilation, you can serve it with any static file server:

```bash
# Option 1: Firebase emulator
firebase emulators:start

# Option 2: Any static server
npx serve .
# or
python -m http.server 8080
```

### Firebase Configuration

1. Copy `firebaseConfig.ts` and replace with your Firebase project credentials:

```typescript
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

2. Deploy Firestore security rules
3. Deploy Cloud Functions:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

---

## Firebase Setup

### Authentication

- **Email/Password** auth provider enabled
- Email verification via Cloud Function (`sendVerificationCode`) with 6-digit codes
- Demo mode fallback when Cloud Functions aren't deployed

### Firestore Collections

| Collection | Purpose | Access |
|-----------|---------|--------|
| `users` | Private user profiles (email, legal name, dues status) | Owner + Admin |
| `public_users` | Public-facing data (display name, scores, rank) | All authenticated |
| `userPicks` | Per-user pick selections keyed by event ID | Owner + Admin |
| `app_state` | Singleton config documents (see below) | Varies |
| `email_verifications` | Temporary verification codes | Server-only |
| `invitation_codes` | League invite codes | Admin |
| `admin_logs` | Audit trail for admin actions | Admin |

### `app_state` Documents

| Document | Contents |
|----------|----------|
| `race_results` | All race results keyed by event ID, with scoring snapshots |
| `form_locks` | Manual lock overrides per event `{ [eventId]: boolean }` |
| `scoring_config` | Active scoring profile + all profiles array |
| `entities` | Current drivers and constructors with class/active status |
| `event_schedules` | Session time overrides and sprint toggles |
| `league_config` | League-wide settings (dues amount, etc.) |
| `maintenance` | Maintenance mode state and message |

---

## Scoring System

### Points Structure (Default)

| Category | Distribution |
|----------|-------------|
| **Grand Prix Finish** | 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 (P1–P10) |
| **Sprint Finish** | 8, 7, 6, 5, 4, 3, 2, 1 (P1–P8) |
| **GP Qualifying** | 3, 2, 1 (P1–P3) |
| **Sprint Qualifying** | 3, 2, 1 (P1–P3) |
| **Fastest Lap** | 3 points |

### How Team Scoring Works

Points flow **from drivers to their constructors**. When a driver finishes P1, their team gets those 25 points. If you picked that team, you earn the combined points of both drivers on that team across all scored sessions.

### Usage Limits (Per Season)

| Class | Team Picks | Driver Picks |
|-------|-----------|-------------|
| **Class A** (top 5 constructors) | 10 uses | 8 uses |
| **Class B** (remaining constructors) | 4 uses | 4 uses |

### Historical Accuracy

When results are saved, the system snapshots the active `PointsSystem` and driver-to-team mappings (`driverTeams`) into the event result document. This ensures historical scores remain accurate even if rules change or drivers transfer teams mid-season.

### Penalties

Admins can apply percentage-based penalties (0–100%) to specific user picks per event, with a reason field for transparency.

---

## Design System

The platform uses a **Formula One Premium** dark aesthetic.

### Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-red` | `#DA291C` | CTAs, active states, highlights |
| `carbon-black` | `#0A0A0A` | Primary background |
| `ghost-white` | `#F5F5F5` | Primary text |
| `accent-gray` | `#2C2C2C` | Card backgrounds, borders |
| `highlight-silver` | `#C0C0C0` | Secondary text, metadata |

### Visual Patterns

- `.bg-carbon-fiber` — Textured card/overlay backgrounds
- `.bg-checkered-flag` — Victory/completion states
- `animate-drive-in` — Element entrance animations
- `animate-peek-up` — Subtle reveal animations
- `sheen-sweep` — Glass reflection effect

### Typography

- **Font Family:** Exo 2 (Google Fonts)
- **Titles:** 900 weight (Black)
- **Data/Metrics:** Monospace
- **Body:** 400–600 weight

---

## Cloud Functions

Located in `functions/index.js`. Deployed as Firebase Gen 2 Cloud Functions.

| Function | Trigger | Purpose |
|----------|---------|---------|
| `sendVerificationCode` | `onCall` | Generates 6-digit code, stores in Firestore, emails via Nodemailer |
| `manualLeaderboardSync` | `onCall` | Recalculates all user scores and syncs to `public_users` |
| `onRaceResultsChange` | `onDocumentWritten` | Auto-triggers score recalculation when `race_results` updates |

### Deployment

```bash
cd functions
npm install
firebase deploy --only functions
```

### Environment

- **Runtime:** Node.js 20
- **Region:** `us-central1` (must match `getFunctions()` client config)
- **Email:** Configure Gmail App Password in function environment or use a transactional email service

---

## Admin Panel

Accessible only to users with admin privileges. The admin panel provides:

| Section | Capabilities |
|---------|-------------|
| **Dashboard** | Quick stats, league health overview |
| **Results Manager** | Enter/edit race results with full finishing order, qualifying, sprint, fastest lap |
| **Form Locks** | Override schedule-based pick deadlines per event |
| **User Management** | View members, update dues status, apply/remove pick penalties |
| **Scoring Settings** | Create scoring profiles, switch active profile |
| **Entity Manager** | Add/edit/deactivate drivers and constructors |
| **Schedule Manager** | Override session times, toggle sprint weekends |
| **Invitations** | Generate, reserve, and track invitation codes |
| **Database Tools** | Manual leaderboard sync, data management |

### Maintenance Mode

Activating maintenance mode displays an F1-themed "Red Flag" screen to all non-admin users, preventing access during critical operations like results entry or scoring recalculation.

---

## Architecture Decisions

### Why Browser-Side Babel?

The project was bootstrapped in Google AI Studio which uses browser-side Babel transpilation with import maps. This enables rapid prototyping with zero build configuration. A migration to Vite is planned for the v2 codebase.

### Why Flat File Structure?

Solo-developer pragmatism. All components live in a single `components/` directory. The v2 codebase will migrate to feature-based organization.

### PII Segregation

User data is split across two collections for privacy. `users/` stores private info (email, legal name) while `public_users/` stores only what the leaderboard needs (display name, scores). This allows Firestore security rules to expose leaderboard data without leaking PII.

### Service Layer Enforcement

All Firestore operations are routed through `firestoreService.ts`. UI components never call `addDoc`, `setDoc`, or `updateDoc` directly. This centralizes validation, error handling, and makes the data layer testable.

### Real-Time Architecture

The app uses Firestore `onSnapshot` listeners (not polling) for all shared state: race results, form locks, scoring config, and user profiles. This means all 40 connected clients see updates within seconds of an admin action.

### Transactional User Creation

New user creation uses `runTransaction` to atomically write to both `users/` and `public_users/`. This prevents orphaned records if either write fails.

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full optimization plan. Key priorities:

- **Vite Migration** — Replace browser-side Babel with a proper build pipeline
- **Feature-Based Architecture** — Reorganize flat file structure
- **Firebase Emulator Config** — Full local development workflow
- **Multi-League Support** — Transform single-league to multi-tenant platform
- **Internationalization** — Support for non-English leagues
- **Backup & Recovery** — Automated Firestore backups to Cloud Storage

---

## License

Private project. Not open source.

---

## Acknowledgments

Built with ☕ and an unhealthy amount of race weekend adrenaline.

*Lights out and away we go.* 🏁
