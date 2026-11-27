import type { Report } from './report.ts';

export function headRunsFor(reports: Report[], sha: string): Report[] {
  return reports
    .filter((r) => r.sides.some((s) => s.name === 'head' && s.sha === sha && !s.dirty))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

// One line for release-gates.sh show. It informs and never gates: visual diffs need a person to read them.
export function runLine(reports: Report[], sha: string): string {
  const [latest] = headRunsFor(reports, sha);
  if (!latest) return '  [~] e2e: no compare run has this commit as its head (warn only; npm run e2e:compare -- --base origin/prod --head <ref>)';
  const base = latest.sides.find((s) => s.name === 'base')?.target ?? '?';
  if (latest.rows.length === 0) return `  [~] e2e: ${latest.run} vs ${base}: no surfaces selected (warn only)`;
  const changed = latest.rows.filter((r) => r.status === 'changed').length;
  return `  [~] e2e: ${latest.run} vs ${base}: ${changed} changed, ${latest.hardFailures.length} hard failures, ${latest.rows.length} rows (warn only)`;
}
