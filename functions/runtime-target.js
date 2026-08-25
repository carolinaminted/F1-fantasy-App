const PROJECT_BY_ENVIRONMENT = Object.freeze({
  staging: 'formula-fantasy-staging',
  production: 'formula-fantasy-1',
});

/**
 * Firebase-managed deployments omit both values and use their own project.
 * Cross-project portal callables must provide both values and match this
 * allowlist so a revision cannot silently point at the wrong data plane.
 */
const resolveRuntimeTarget = (environment = process.env) => {
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

module.exports = { PROJECT_BY_ENVIRONMENT, resolveRuntimeTarget };

