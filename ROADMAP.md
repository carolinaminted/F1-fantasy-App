# Formula 1 Fantasy App - Optimization Roadmap

## 1. User Experience (UX)
*   **Unified App Shell:** Implement a consistent layout wrapper to handle navigation state and eliminate layout shifts between page transitions.
*   **Non-Blocking Feedback:** Replace native browser `alert()` calls with a lightweight Toast notification system for smoother interaction.
*   **Visual Continuity:** Replace full-screen loading spinners with Skeleton loaders to maintain visual context during data fetches.

## 2. Scoring & Data Integrity
*   **Centralized Logic:** Move all lock/deadline logic to a single `useLeagueState` hook to ensure Admin and Player views always obey the same rules.
*   **Robust Scoring:** Enhance `scoringService` to handle partial/in-progress results safely, allowing for live updates without breaking the leaderboard.
*   **Data Validation:** Implement stricter runtime checks on Firestore data to prevent "undefined" errors in the UI.

## 3. Simplicity & Maintenance
*   **Consolidated Admin:** Merge separate Admin pages (Locks, Results, Dues) into a single "League Control" dashboard to reduce code complexity.
*   **Reduced State:** Simplify `App.tsx` by grouping related state, making the codebase easier for a single developer to manage.