const { resolveDeployProjectId } = require('./runtime-service-account');

const PROJECT_BY_ENVIRONMENT = Object.freeze({
  staging: 'formula-fantasy-staging',
  production: 'formula-fantasy-1',
});

/**
 * Projects that host functions but hold no league data of their own. Without a target, the
 * Admin SDK falls back to the hosting project's empty Firestore and every callable quietly runs
 * against nothing — so for these the target is committed here rather than trusted to an env file
 * that may not exist on the machine doing the deploy.
 */
const PINNED_TARGET_BY_HOST_PROJECT = Object.freeze({
  'lights-out-league-prod': 'production',
});

const resolveConfiguredTarget = (environment) => {
  const appEnvironment = environment.APP_ENV?.trim();
  const firebaseProjectId = environment.FIREBASE_PROJECT_ID?.trim();

  if (!appEnvironment && !firebaseProjectId) return null;
  if (!appEnvironment || !firebaseProjectId) {
    throw new Error('APP_ENV and FIREBASE_PROJECT_ID must be configured together.');
  }

  const expectedProjectId = PROJECT_BY_ENVIRONMENT[appEnvironment];
  if (!expectedProjectId) {
    throw new Error('APP_ENV must be explicitly set to staging or production.');
  }
  if (firebaseProjectId !== expectedProjectId) {
    throw new Error(
      `APP_ENV=${appEnvironment} must target FIREBASE_PROJECT_ID=${expectedProjectId}.`,
    );
  }

  return Object.freeze({ appEnvironment, firebaseProjectId });
};

/**
 * Firebase-managed deployments omit both values and use their own project. A pinned host always
 * gets its committed target; env values, if present, must agree with it. Any disagreement throws
 * at cold start, because a loud failure beats serving from the wrong data plane.
 */
const resolveRuntimeTarget = (environment = process.env) => {
  const configured = resolveConfiguredTarget(environment);
  const hostProjectId = resolveDeployProjectId(environment);
  const pinnedEnvironment = PINNED_TARGET_BY_HOST_PROJECT[hostProjectId];

  if (!pinnedEnvironment) return configured;

  const pinnedProjectId = PROJECT_BY_ENVIRONMENT[pinnedEnvironment];
  if (!pinnedProjectId || pinnedProjectId === hostProjectId) {
    throw new Error(`${hostProjectId} has no valid pinned data target.`);
  }
  if (configured && configured.firebaseProjectId !== pinnedProjectId) {
    throw new Error(
      `${hostProjectId} is pinned to ${pinnedProjectId}; ` +
        `FIREBASE_PROJECT_ID=${configured.firebaseProjectId} disagrees.`,
    );
  }

  return Object.freeze({ appEnvironment: pinnedEnvironment, firebaseProjectId: pinnedProjectId });
};

module.exports = { PROJECT_BY_ENVIRONMENT, PINNED_TARGET_BY_HOST_PROJECT, resolveRuntimeTarget };
