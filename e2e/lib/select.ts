import picomatch from 'picomatch';

// Changing one of these can change any page.
export const SHARED = [
  'App.tsx', 'routes.ts', 'index.tsx', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json',
  '.env.staging', 'styles/**', 'components/ui/**', 'contexts/**', 'services/**', 'public/**',
];

// These cannot change what a local --mode staging build renders: server code and rules run from
// the staging deploy, and the harness is the same on both sides of a comparison.
export const IGNORED = [
  'e2e/**', 'functions/**', 'scripts/**', 'docs/**', 'regression/**', '.githooks/**', '.claude/**', '.github/**',
  '.superpowers/**', '**/*.md', '**/*.test.ts', 'firestore.rules', 'firestore.indexes.json', 'firebase.json',
  '.firebaserc', '*.sh', 'cloudbuild.*.yaml', 'Dockerfile', '.dockerignore', '.gcloudignore', '.gitignore',
  '.env.production', '.env.prod-staging', 'nginx.conf',
];

export const isShared = picomatch(SHARED, { dot: true });
export const isIgnored = picomatch(IGNORED, { dot: true });

export type Selection = { all: boolean; ids: string[]; reasons: string[] };

export function selectSurfaces(changed: string[], closures: Map<string, Set<string>>): Selection {
  const reasons: string[] = [];
  const hits = new Set<string>();
  let all = false;
  for (const file of [...new Set(changed)].sort()) {
    if (isIgnored(file)) continue;
    if (isShared(file)) { all = true; reasons.push(`shared ${file} → all`); continue; }
    const ids = [...closures].filter(([, files]) => files.has(file)).map(([id]) => id);
    if (ids.length) { ids.forEach((id) => hits.add(id)); reasons.push(`${file} → ${ids.join(', ')}`); }
    else { all = true; reasons.push(`unmapped ${file} → all`); }
  }
  if (!changed.length) reasons.push('no changed files');
  const ids = [...closures.keys()].filter((id) => all || hits.has(id));
  return { all, ids, reasons };
}
