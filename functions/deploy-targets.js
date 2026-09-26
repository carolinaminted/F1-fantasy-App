/**
 * Which functions each project deploys. The deploy scripts build their `--only` list from here so
 * it is never typed by hand — a stray name either deploys something the project must not run or
 * silently skips something it must.
 *
 * formula-fantasy-1 is the data plane: it runs the two Firestore triggers and nothing else, which
 * keeps the mail credential out of it. lights-out-league-prod hosts the member-facing callables
 * against formula-fantasy-1's data (see runtime-target.js). Staging runs everything in one project.
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

const target = (functions) =>
  Object.freeze({ region: 'us-central1', runtime: 'nodejs22', functions: Object.freeze(functions) });

const DEPLOY_TARGETS = Object.freeze({
  'formula-fantasy-staging': target([...CALLABLES, ...TRIGGERS].sort()),
  'formula-fantasy-1': target([...TRIGGERS]),
  'lights-out-league-prod': target([...CALLABLES]),
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

module.exports = { TRIGGERS, CALLABLES, DEPLOY_TARGETS, resolveDeployTarget, onlyFunctionsFlag };

// `node deploy-targets.js <project> --only` prints the --only value; `--list` prints one name per
// line. Shell scripts read it this way rather than keeping their own copy.
if (require.main === module) {
  const [projectId, mode = '--only'] = process.argv.slice(2);
  try {
    if (mode === '--only') console.log(onlyFunctionsFlag(projectId));
    else if (mode === '--list') console.log(resolveDeployTarget(projectId).functions.join('\n'));
    else throw new Error(`Unknown mode "${mode}". Use --only or --list.`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
