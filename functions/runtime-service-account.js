/**
 * Runtime identity for the Gen 2 functions, by deploy project.
 *
 * Left unset, Gen 2 functions run as the project's default compute service account, which holds
 * roles/editor — any function compromise becomes project-wide write access. These deploy instead
 * as a dedicated least-privilege account.
 *
 * Addresses are spelled out per project rather than resolved from a bare name: firebase-tools
 * accepts only 'service-account@' or a full 'service-account@{project-id}.iam.gserviceaccount.com',
 * and a full address states which identity lands where without the reader having to know how the
 * short form expands.
 *
 * formula-fantasy-1 is deliberately absent — it has no such account, its Node 20 scoring triggers
 * are retired at cutover, and an emergency deploy there must not be blocked by this. An unlisted
 * project falls through to the platform default. Add one here only after creating the account.
 */
const SERVICE_ACCOUNT_BY_PROJECT = new Map([
  [
    'formula-fantasy-staging',
    'lol-functions-runtime@formula-fantasy-staging.iam.gserviceaccount.com',
  ],
  [
    'lights-out-league-prod',
    'lol-functions-runtime@lights-out-league-prod.iam.gserviceaccount.com',
  ],
]);

/**
 * The only two shapes firebase-tools will accept, quoted from its own rejection message:
 * "Service account must be of the form 'service-account@' or
 * 'service-account@{project-id}.iam.gserviceaccount.com'".
 *
 * A bare name looks reasonable and is silently wrong — it passes every local check and is not
 * rejected until the deploy has already uploaded source and started updating functions.
 */
const VALID_SERVICE_ACCOUNT = /^[^@\s]+@$|^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/;

/**
 * The project a deploy is targeting. firebase-tools sets GCLOUD_PROJECT during discovery;
 * FIREBASE_CONFIG is the fallback the Firebase runtime populates.
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
 * The service account this deploy should run as, or null to accept the platform default.
 * Throws on a malformed address so a typo in the table fails at discovery, with a message that
 * names the offender, rather than surfacing as an opaque mid-deploy FirebaseError.
 */
const resolveRuntimeServiceAccount = (environment = process.env) => {
  const projectId = resolveDeployProjectId(environment);
  const serviceAccount = SERVICE_ACCOUNT_BY_PROJECT.get(projectId);

  if (!serviceAccount) return null;
  if (!VALID_SERVICE_ACCOUNT.test(serviceAccount)) {
    throw new Error(
      `Runtime service account for ${projectId} is malformed: "${serviceAccount}". ` +
        "Expected 'name@' or 'name@{project-id}.iam.gserviceaccount.com'.",
    );
  }
  return serviceAccount;
};

module.exports = {
  SERVICE_ACCOUNT_BY_PROJECT,
  VALID_SERVICE_ACCOUNT,
  resolveDeployProjectId,
  resolveRuntimeServiceAccount,
};
