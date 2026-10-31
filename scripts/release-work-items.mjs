#!/usr/bin/env node
// Which tracker work items in a release have actually reached members?
//
// Read-only. Reads the `Refs: [ID]` lines and changed files of every commit in a range, and the
// deploy records in refs/notes/release-gates:
//   promoted:             web    (promote-production.sh)
//   data-plane-deployed:  the 2 scoring triggers in formula-fantasy-1 (deploy-data-plane.sh)
//   portal-deployed:      the 5 callables in lights-out-league-prod (deploy-portal.sh)
// A functions/ change is only live once BOTH Functions deploys include it: a file cannot be mapped
// to the functions it affects, so this errs towards "not yet".
//
// Refs lines are parsed from the body, not with %(trailers): they sit in their own paragraph above
// Co-Authored-By, so git does not treat them as trailers.
//
// Usage: node scripts/release-work-items.mjs [--from <ref>] [--to <ref>] [--json]
//   --to    defaults to origin/prod
//   --from  defaults to the nearest earlier commit with a `promoted:` note

import { execFileSync, spawnSync } from 'node:child_process';

const NOTES_REF = 'refs/notes/release-gates';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const isAncestor = (a, b) => spawnSync('git', ['merge-base', '--is-ancestor', a, b]).status === 0;

const args = process.argv.slice(2);
const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const asJson = args.includes('--json');

// Not a forced fetch: a deploy record whose push failed must survive until it is pushed.
spawnSync('git', ['fetch', '--quiet', 'origin', `${NOTES_REF}:${NOTES_REF}`]);

// Every deploy record: { kind, at, sha }.
const records = [];
const noteList = spawnSync('git', ['notes', `--ref=${NOTES_REF}`, 'list'], { encoding: 'utf8' }).stdout || '';
for (const line of noteList.split('\n').filter(Boolean)) {
    const sha = line.split(' ')[1];
    const body = git('notes', `--ref=${NOTES_REF}`, 'show', sha);
    for (const m of body.matchAll(/^(promoted|data-plane-deployed|portal-deployed): (\S+)/gm)) {
        records.push({ kind: m[1], at: m[2], sha });
    }
}

// What each surface serves now is the most recent deploy by time, not by graph position, so a
// rollback to an older commit counts as un-shipping what came after it.
const latest = (kind) => records.filter(r => r.kind === kind).sort((a, b) => b.at.localeCompare(a.at))[0];
const serving = {
    web: latest('promoted'),
    dataPlane: latest('data-plane-deployed'),
    portal: latest('portal-deployed'),
};

const to = git('rev-parse', '--verify', `${opt('--to') || 'origin/prod'}^{commit}`);
let from = opt('--from') && git('rev-parse', '--verify', `${opt('--from')}^{commit}`);
if (!from) {
    const earlier = records
        .filter(r => r.kind === 'promoted' && r.sha !== to && isAncestor(r.sha, to))
        .map(r => ({ sha: r.sha, depth: Number(git('rev-list', '--count', r.sha)) }))
        .sort((a, b) => b.depth - a.depth)[0];
    if (!earlier) {
        console.error('release-work-items: no earlier promoted commit found; pass --from');
        process.exit(1);
    }
    from = earlier.sha;
}

const surfaceOf = (file) => {
    if (file.startsWith('functions/')) return 'functions';
    if (file === 'firestore.rules' || file === 'firestore.indexes.json') return 'rules';
    if (/\.md$/.test(file) || /^(lol-docs|scripts|\.githooks|\.claude|docs)\//.test(file)) return null;
    return 'web';
};

// Which deploys a (commit, surface) still waits on. Empty means it is live.
const waitingOn = (sha, surface) => {
    const missing = [];
    const has = (rec) => rec && isAncestor(sha, rec.sha);
    if (surface === 'web' && !has(serving.web)) missing.push('web');
    if (surface === 'functions') {
        if (!has(serving.dataPlane)) missing.push('data-plane');
        if (!has(serving.portal)) missing.push('portal');
    }
    if (surface === 'rules') missing.push('rules (manual)');
    return missing;
};

const items = new Map();
const untracked = [];
const shas = git('rev-list', '--no-merges', '--reverse', `${from}..${to}`).split('\n').filter(Boolean);
for (const sha of shas) {
    const short = sha.slice(0, 7);
    const subject = git('log', '-1', '--format=%s', sha);
    const body = git('log', '-1', '--format=%B', sha);
    const ids = [...body.matchAll(/^Refs:(.*)$/gm)]
        .flatMap(m => [...m[1].matchAll(/\[([A-Z][A-Z0-9]*-\d+)\]/g)].map(x => x[1]));
    const files = git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha).split('\n').filter(Boolean);
    const surfaces = [...new Set(files.map(surfaceOf).filter(Boolean))];
    if (ids.length === 0) {
        untracked.push({ sha: short, subject });
        continue;
    }
    const missing = surfaces.flatMap(s => waitingOn(sha, s));
    for (const id of new Set(ids)) {
        const item = items.get(id) || { id, commits: [], surfaces: new Set(), waiting: new Set() };
        item.commits.push(short);
        surfaces.forEach(s => item.surfaces.add(s));
        missing.forEach(m => item.waiting.add(m));
        items.set(id, item);
    }
}

const classify = (item) => {
    if (/^INV-/.test(item.id)) return 'investigation';
    if (/-00$/.test(item.id)) return 'epic';
    return 'tracker';
};
const rows = [...items.values()].map(item => ({
    id: item.id,
    kind: classify(item),
    commits: item.commits,
    surfaces: [...item.surfaces],
    waiting: [...item.waiting],
    status: item.waiting.size === 0 ? 'LIVE' : `WAITING: ${[...item.waiting].join(', ')}`,
}));

const report = {
    range: { from: from.slice(0, 7), to: to.slice(0, 7) },
    serving: Object.fromEntries(Object.entries(serving).map(([k, r]) => [k, r ? { sha: r.sha.slice(0, 7), at: r.at } : null])),
    items: rows,
    untracked,
};

if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
}

const fmt = (r) => (r ? `${r.sha.slice(0, 7)} (${r.at})` : 'no record');
console.log(`Work items in ${report.range.from}..${report.range.to}`);
console.log(`  web serves ${fmt(serving.web)}, data plane ${fmt(serving.dataPlane)}, portal ${fmt(serving.portal)}`);
const print = (title, list) => {
    if (list.length === 0) return;
    console.log(`\n${title}`);
    for (const r of list) {
        console.log(`  ${r.id.padEnd(9)} ${r.status.padEnd(34)} ${(r.surfaces.join('+') || 'repo only').padEnd(16)} ${r.commits.join(' ')}`);
    }
};
print('Tracker items:', rows.filter(r => r.kind === 'tracker'));
print('Epics (never closed automatically):', rows.filter(r => r.kind === 'epic'));
print('Investigations (LOL Investigations DB, close by hand):', rows.filter(r => r.kind === 'investigation'));
if (untracked.length) {
    console.log(`\nCommits with no work item: ${untracked.length}`);
    for (const c of untracked) console.log(`  ${c.sha} ${c.subject}`);
}
