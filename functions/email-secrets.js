/**
 * Secret Manager names for the Gmail app password, by deploy project.
 *
 * These are declared in code so `firebase deploy` binds them itself. The alternative — binding
 * them afterwards with `gcloud run services update --set-secrets` — writes the Cloud Run service
 * directly and blanks the function's Cloud Functions v2 record. After that, `firebase deploy
 * --only functions` stops rebuilding the affected functions altogether: across three deploys
 * (2026-08-26, and twice on 2026-08-30) only the five non-email functions were ever rebuilt.
 *
 * formula-fantasy-1 is deliberately absent, for the same reason it is absent from
 * runtime-service-account.js: it still holds the credential as plaintext function config, its
 * Node 20 functions are retired at cutover, and an emergency deploy there must not be blocked by
 * a secret that does not exist in that project. An unlisted project falls through to reading
 * EMAIL_USER / EMAIL_PASS from the environment, which is exactly what it does today.
 */
const SECRET_NAMES_BY_PROJECT = new Map([
  [
    'formula-fantasy-staging',
    { user: 'lol-staging-email-user', pass: 'lol-staging-email-pass' },
  ],
  [
    'lights-out-league-prod',
    { user: 'lol-prod-email-user', pass: 'lol-prod-email-pass' },
  ],
]);

/**
 * A Secret Manager name must be usable as a `defineSecret` identifier. Anything else is a typo in
 * the table above, and should fail at discovery — before the deploy uploads source — rather than
 * as an opaque mid-deploy error.
 */
const VALID_SECRET_NAME = /^[A-Za-z0-9_-]{1,255}$/;

/**
 * The project a deploy is targeting. Mirrors runtime-service-account.js: firebase-tools sets
 * GCLOUD_PROJECT during discovery, and FIREBASE_CONFIG is the fallback the Firebase runtime
 * populates.
 */
const resolveDeployProjectId = (environment = process.env) => {
  if (environment.GCLOUD_PROJECT) return environment.GCLOUD_PROJECT;
  try {
    return JSON.parse(environment.FIREBASE_CONFIG || '{}').projectId || '';
  } catch {
    return '';
  }
};

/**
 * The secret names this deploy should bind, or null to fall back to plaintext environment
 * variables. Throws on a malformed name so a typo fails at discovery, naming the offender.
 */
const resolveEmailSecretNames = (environment = process.env) => {
  const projectId = resolveDeployProjectId(environment);
  const names = SECRET_NAMES_BY_PROJECT.get(projectId);

  if (!names) return null;
  for (const [role, name] of Object.entries(names)) {
    if (!VALID_SECRET_NAME.test(name)) {
      throw new Error(
        `Email ${role} secret for ${projectId} is malformed: "${name}". ` +
          'Expected letters, digits, underscores or hyphens.',
      );
    }
  }
  return names;
};

module.exports = {
  SECRET_NAMES_BY_PROJECT,
  VALID_SECRET_NAME,
  resolveDeployProjectId,
  resolveEmailSecretNames,
};
