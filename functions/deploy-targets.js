/**
 * Which functions each project deploys. The deploy scripts build their `--only` list from here so
 * it is never typed by hand — a stray name either deploys something the project must not run or
 * silently skips something it must.
 *
 * formula-fantasy-1 is the data plane: it runs the two Firestore triggers and nothing else, which
 * keeps the mail credential out of it. lights-out-league-prod hosts every callable against
 * formula-fantasy-1's data (see runtime-target.js). Staging runs everything in one project.
 */
const TRIGGERS = Object.freeze([
  'updateLeaderboardOnCancellation',
  'updateLeaderboardOnResults',
]);

const CALLABLES = Object.freeze([
  'manualLeaderboardSync',
  'sendAuthCode',
  'sendPasswordResetLink',
  'validateInvitationCode',
  'verifyAuthCode',
]);

/**
 * The admin-only season lifecycle callables ([ROLL-08]). The portal hosts them alongside CALLABLES;
 * deploy-portal.sh creates any that do not exist there yet.
 */
const SEASON_CALLABLES = Object.freeze([
  'archiveSeason',
  'backupLeague',
  'concludeSeason',
  'openSeason',
  'startNewSeason',
]);

/**
 * Callables that need more than the portal's default 60s timeout and 256Mi. functions/index.js
 * passes these to onCall and deploy-portal.sh passes them to gcloud, so the two cannot drift.
 */
const LONG_RUNNING = Object.freeze({
  archiveSeason: Object.freeze({ timeoutSeconds: 540, memory: '512MiB' }),
  backupLeague: Object.freeze({ timeoutSeconds: 540, memory: '512MiB' }),
  startNewSeason: Object.freeze({ timeoutSeconds: 540, memory: '512MiB' }),
});

const target = (functions) =>
  Object.freeze({ region: 'us-central1', runtime: 'nodejs22', functions: Object.freeze(functions) });

const DEPLOY_TARGETS = Object.freeze({
  'formula-fantasy-staging': target([...CALLABLES, ...SEASON_CALLABLES, ...TRIGGERS].sort()),
  'formula-fantasy-1': target([...TRIGGERS]),
  'lights-out-league-prod': target([...CALLABLES, ...SEASON_CALLABLES].sort()),
});

const resolveDeployTarget = (projectId) => {
  const deployTarget = DEPLOY_TARGETS[projectId];
  if (!deployTarget) {
    throw new Error(`No deploy target is declared for project "${projectId}".`);
  }
  return deployTarget;
};

/** The value for `firebase deploy --only`, e.g. "functions:a,functions:b". */
const onlyFunctionsFlag = (projectId) =>
  resolveDeployTarget(projectId).functions.map((name) => `functions:${name}`).join(',');

module.exports = { TRIGGERS, CALLABLES, SEASON_CALLABLES, LONG_RUNNING, DEPLOY_TARGETS, resolveDeployTarget, onlyFunctionsFlag };

// `node deploy-targets.js <project> --only` prints the --only value; `--list` prints one name per
// line; `--long-running` prints "<name> <timeoutSeconds> <memory in gcloud's Mi form>" per line for
// the project's long-running functions. Shell scripts read it this way rather than keeping a copy.
if (require.main === module) {
  const [projectId, mode = '--only'] = process.argv.slice(2);
  try {
    if (mode === '--only') console.log(onlyFunctionsFlag(projectId));
    else if (mode === '--long-running') {
      resolveDeployTarget(projectId).functions.filter((name) => LONG_RUNNING[name]).forEach((name) => {
        const { timeoutSeconds, memory } = LONG_RUNNING[name];
        console.log(`${name} ${timeoutSeconds} ${memory.replace(/MiB$/, 'Mi')}`);
      });
    }
    else if (mode === '--list') console.log(resolveDeployTarget(projectId).functions.join('\n'));
    else throw new Error(`Unknown mode "${mode}". Use --only, --list or --long-running.`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
