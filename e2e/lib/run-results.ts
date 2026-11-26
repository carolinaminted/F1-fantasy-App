export type Annotation = { type: string; description?: string };
export type TestOutcome = { title: string; project: string; status: string; error?: string; annotations: Annotation[] };

type JsonResult = { status?: string; error?: { message?: string }; errors?: { message?: string }[]; annotations?: Annotation[] };
type JsonTest = { projectName: string; annotations?: Annotation[]; results?: JsonResult[] };
type JsonSuite = { specs?: { title: string; tests: JsonTest[] }[]; suites?: JsonSuite[] };

const ANSI = /\u001b\[[0-9;]*m/g;
const clean = (s?: string) => s?.replace(ANSI, '');

// Runtime annotations sit on the test in older reporters and on the result in newer ones; read both.
const dedupe = (list: Annotation[]) => [...new Map(list.map((a) => [`${a.type}\u0000${a.description ?? ''}`, a])).values()];

export function readPlaywrightResults(json: unknown): TestOutcome[] {
  const out: TestOutcome[] = [];
  const walk = (suite: JsonSuite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests) {
        const last = t.results?.at(-1);
        out.push({
          title: spec.title,
          project: t.projectName,
          status: last?.status ?? 'skipped',
          // A test can fail in its body and again at fixture teardown (console errors); keep every message.
          error: clean(last?.errors?.length ? last.errors.map((e) => e.message ?? '').join('\n---\n') : last?.error?.message),
          annotations: dedupe([...(t.annotations ?? []), ...(last?.annotations ?? [])]),
        });
      }
    }
    for (const s of suite.suites ?? []) walk(s);
  };
  for (const s of (json as { suites?: JsonSuite[] }).suites ?? []) walk(s);
  return out;
}

export function readPlaywrightErrors(json: unknown): string[] {
  return ((json as { errors?: { message?: string }[] }).errors ?? []).map((e) => clean(e.message) ?? 'unknown error');
}
