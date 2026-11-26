#!/usr/bin/env node
//
// One-time move of admin authority from users/{uid}.isAdmin to the `admin` custom claim ([SEC-01]).
// Run it before the functions deploy that starts reading the claim, or every admin is locked out.
//
// Usage (from functions/, with application-default credentials for the staging project):
//   node scripts/bootstrap-admin-claims.js                      # dry run: list the candidates
//   node scripts/bootstrap-admin-claims.js --apply --grant <uid>[,<uid>...]
//
// --apply needs the uids spelled out because the source of the list is the very field a member
// can forge on themselves. Granting "everyone flagged isAdmin" would turn a forged flag into a
// real claim, so a person reads the dry run and names who is genuine.
//
// Staging only. Production gets its own guarded path with [SEC-20].

const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { withAdminClaim } = require('../admin-role');

const TARGET_PROJECT = 'formula-fantasy-staging';

const parseArguments = (argv) => {
  const options = { apply: false, grant: [] };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--apply') options.apply = true;
    else if (argv[index] === '--grant' && argv[index + 1]) options.grant = argv[++index].split(',').map((uid) => uid.trim()).filter(Boolean);
    else throw new Error(`Unsupported argument "${argv[index]}". Only --apply and --grant <uid,uid> are accepted.`);
  }
  if (options.grant.length && !options.apply) throw new Error('--grant only makes sense with --apply.');
  if (options.apply && !options.grant.length) throw new Error('--apply needs --grant <uid,uid>: name each admin from the dry run.');
  return options;
};

/**
 * @param flagged   [{ uid, displayName }] for every users doc with isAdmin === true
 * @param accounts  Map uid -> { email, customClaims } for the Auth accounts that exist
 * @param claimed   uids that already carry the admin claim
 */
const planClaims = (flagged, accounts, claimed) => {
  const flaggedUids = new Set(flagged.map((user) => user.uid));
  return {
    candidates: flagged.filter((user) => accounts.has(user.uid) && !claimed.has(user.uid)),
    alreadyClaimed: flagged.filter((user) => claimed.has(user.uid)),
    noAccount: flagged.filter((user) => !accounts.has(user.uid)),
    claimWithoutFlag: [...claimed].filter((uid) => !flaggedUids.has(uid)),
  };
};

/** The uids to grant, or a thrown error naming any that the dry run did not offer. */
const resolveGrants = (plan, grant) => {
  const offered = new Set(plan.candidates.map((user) => user.uid));
  const refused = grant.filter((uid) => !offered.has(uid));
  if (refused.length) throw new Error(`Not a candidate (no isAdmin flag, no account, or already claimed): ${refused.join(', ')}`);
  return grant;
};

const listAccounts = async (auth) => {
  const accounts = new Map();
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    page.users.forEach((user) => accounts.set(user.uid, { email: user.email, customClaims: user.customClaims }));
    pageToken = page.pageToken;
  } while (pageToken);
  return accounts;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const app = initializeApp({ credential: applicationDefault(), projectId: TARGET_PROJECT });
  const auth = getAuth(app);

  const flaggedSnap = await getFirestore(app).collection('users').where('isAdmin', '==', true).get();
  const flagged = flaggedSnap.docs.map((doc) => ({ uid: doc.id, displayName: doc.data().displayName }));
  const accounts = await listAccounts(auth);
  const claimed = new Set([...accounts].filter(([, account]) => account.customClaims?.admin === true).map(([uid]) => uid));
  const plan = planClaims(flagged, accounts, claimed);

  const line = (user) => `  ${user.uid}  ${accounts.get(user.uid)?.email ?? '(no account)'}  ${user.displayName ?? ''}`;
  console.log(`Project: ${TARGET_PROJECT}`);
  console.log(`\nCandidates (isAdmin flag, no claim yet): ${plan.candidates.length}`);
  plan.candidates.forEach((user) => console.log(line(user)));
  console.log(`\nAlready claimed: ${plan.alreadyClaimed.length}`);
  plan.alreadyClaimed.forEach((user) => console.log(line(user)));
  if (plan.noAccount.length) {
    console.log(`\nFlagged isAdmin but no Auth account: ${plan.noAccount.length}`);
    plan.noAccount.forEach((user) => console.log(line(user)));
  }
  if (plan.claimWithoutFlag.length) {
    console.log(`\nClaim without the isAdmin flag (left alone): ${plan.claimWithoutFlag.join(', ')}`);
  }

  if (!options.apply) {
    console.log('\nDry run. Nothing was changed. Re-run with --apply --grant <uid,uid> naming the genuine admins.');
    return;
  }
  for (const uid of resolveGrants(plan, options.grant)) {
    await auth.setCustomUserClaims(uid, withAdminClaim(accounts.get(uid).customClaims, true));
    console.log(`granted admin claim: ${uid}`);
  }
  console.log('\nDone. Each admin gets the claim on their next token refresh (sign out and in, or within the hour).');
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { parseArguments, planClaims, resolveGrants };
