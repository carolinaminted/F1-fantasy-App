import { GuardError } from './guards.ts';

export type CompareArgs = { base: string; head: string; all: boolean; surfaces: string[] | null; full: boolean; plan: boolean; pruneBases: boolean };
export type CaptureArgs = { label: string; target: string; surfaces: string[] | null; full: boolean };

type Parsed = { values: Map<string, string>; flags: Set<string> };

function parse(argv: string[], valueFlags: string[], boolFlags: string[]): Parsed {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const eq = argv[i].indexOf('=');
    const name = eq > 0 ? argv[i].slice(0, eq) : argv[i];
    if (name === '--mode') throw new GuardError('the harness always serves --mode staging; --mode is not accepted');
    if (valueFlags.includes(name)) {
      const value = eq > 0 ? argv[i].slice(eq + 1) : argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
      values.set(name, value);
    } else if (boolFlags.includes(name) && eq < 0) {
      flags.add(name);
    } else {
      throw new Error(`unknown argument ${name}`);
    }
  }
  return { values, flags };
}

const list = (raw?: string) => (raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : null);

export function parseCompareArgs(argv: string[]): CompareArgs {
  const p = parse(argv, ['--base', '--head', '--surfaces'], ['--all', '--full', '--plan', '--prune-bases']);
  return {
    base: p.values.get('--base') ?? 'staging',
    head: p.values.get('--head') ?? 'worktree',
    all: p.flags.has('--all'),
    surfaces: list(p.values.get('--surfaces')),
    full: p.flags.has('--full'),
    plan: p.flags.has('--plan'),
    pruneBases: p.flags.has('--prune-bases'),
  };
}

export function parseCaptureArgs(argv: string[]): CaptureArgs {
  const p = parse(argv, ['--label', '--target', '--surfaces'], ['--full']);
  const label = p.values.get('--label');
  if (!label) throw new Error('--label is required, for example --label after-conclude');
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(label)) throw new Error('--label must be lowercase letters, digits and dashes');
  return { label, target: p.values.get('--target') ?? 'worktree', surfaces: list(p.values.get('--surfaces')), full: p.flags.has('--full') };
}
