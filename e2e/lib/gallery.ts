import type { CaptureRow, Failure, Report } from './report.ts';

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function badge(row: CaptureRow): string {
  const bits: string[] = [row.status];
  if (row.status === 'changed') {
    if (row.diffPixels) bits.push(`${(row.diffRatio * 100).toFixed(2)}% px`);
    if (row.sizeChanged) bits.push('size');
    if (row.ariaChanged) bits.push('aria');
  }
  if (row.unstable) bits.push('unstable');
  return bits.join(' · ');
}

function card(row: CaptureRow): string {
  const figures = Object.entries(row.images).map(([name, src]) =>
    `<figure><figcaption>${esc(name)}</figcaption><a href="${esc(src)}"><img loading="lazy" src="${esc(src)}" alt="${esc(`${row.key} ${name}`)}"></a></figure>`).join('');
  return `<section class="card ${row.status}"><h2>${esc(row.key)} <span>${esc(badge(row))}</span></h2>`
    + row.failures.map((f) => `<p class="fail">${esc(f)}</p>`).join('')
    + `<div class="imgs">${figures}</div>`
    + (row.ariaPatch ? `<pre>${esc(row.ariaPatch)}</pre>` : '')
    + '</section>';
}

const failureList = (title: string, list: Failure[], cls: string) => list.length
  ? `<h2 class="${cls}">${esc(title)}</h2><ul>${list.map((f) => `<li class="${cls}"><b>${esc(f.project)}</b> ${esc(f.title)}<pre>${esc(f.error)}</pre></li>`).join('')}</ul>`
  : '';

export function renderGallery(r: Report): string {
  const count = (s: CaptureRow['status']) => r.rows.filter((x) => x.status === s).length;
  const open = r.rows.filter((x) => x.status !== 'unchanged');
  const quiet = r.rows.filter((x) => x.status === 'unchanged');
  const sides = r.sides.map((s) => `<li><b>${esc(s.name)}</b> ${esc(s.target)}${s.sha ? ` @ ${esc(s.sha.slice(0, 8))}` : ''}${s.dirty ? ' (uncommitted changes)' : ''} — ${esc(s.url)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>e2e ${esc(r.run)}</title>
<style>
body{font:14px/1.4 system-ui,sans-serif;margin:24px;background:#111;color:#eee}
a{color:#9cf} pre{white-space:pre-wrap;background:#000;padding:8px;overflow:auto;max-height:24em}
.card{border:1px solid #333;margin:16px 0;padding:12px}.card h2{font-size:15px;margin:0 0 8px}.card h2 span{font-weight:normal;color:#aaa}
.failed{border-color:#e33}.changed{border-color:#e90}.fail{color:#f66}.warn{color:#fc6}
.imgs{display:flex;gap:8px;align-items:flex-start}figure{margin:0;flex:1;min-width:0}img{width:100%;border:1px solid #333}
</style></head><body>
<h1>e2e ${esc(r.run)}</h1>
<ul>${sides}</ul>
<p>Frozen at ${esc(new Date(r.frozenAt).toISOString())} · ${Math.round(r.durationMs / 1000)} s · ${count('changed')} changed · ${count('failed')} failed · ${count('missing')} missing · ${count('unchanged')} unchanged${count('captured') ? ` · ${count('captured')} captured` : ''}</p>
<details><summary>Selection: ${r.selection.ids.length} surfaces${r.selection.all ? ' (all)' : ''}</summary><ul>${r.selection.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
${failureList('Hard failures', r.hardFailures, 'fail')}
${failureList('Warnings (non-gating)', r.warnings, 'warn')}
${r.blockedWrites.length ? `<details><summary>Writes blocked by read-only mode: ${r.blockedWrites.length}</summary><ul>${r.blockedWrites.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></details>` : ''}
${open.map(card).join('\n')}
${quiet.length ? `<details class="unchanged"><summary>${quiet.length} unchanged</summary>${quiet.map(card).join('\n')}</details>` : ''}
</body></html>
`;
}
