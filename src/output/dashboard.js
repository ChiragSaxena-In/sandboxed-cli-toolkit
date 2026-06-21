/**
 * dashboard.js
 *
 * Generates a single, self-contained, static HTML dashboard summarizing
 * system info, allowlisted env vars, and the CRUD audit trail.
 *
 * Deliberately static (no server, no client-side fetch, no networking):
 * it's rendered once from data already collected in-process and written
 * to disk, consistent with the project's "no networking" safety property.
 *
 * @param {object} params
 * @param {object} params.systemInfo  - from collectSystemInfo()
 * @param {Record<string,string>} params.envInfo - from collectEnvInfo()
 * @param {Array<object>} params.auditLog - from readAuditLog()
 * @param {string} params.sandboxRoot
 * @returns {string} full HTML document
 */
export function renderDashboard({ systemInfo, envInfo, auditLog, sandboxRoot }) {
  const entries = [...auditLog].reverse(); // newest first
  const total = entries.length;
  const succeeded = entries.filter((e) => e.success).length;
  const failed = total - succeeded;
  const rejected = entries.filter(
    (e) => !e.success && /rejected/i.test(e.detail ?? '')
  ).length;
  const successRate = total > 0 ? Math.round((succeeded / total) * 100) : null;

  const actionCounts = entries.reduce((acc, e) => {
    acc[e.action] = (acc[e.action] ?? 0) + 1;
    return acc;
  }, {});
  const maxActionCount = Math.max(1, ...Object.values(actionCounts));

  // Ring geometry for the success-rate indicator (signature element).
  const RING_R = 30;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = successRate === null ? RING_C : RING_C - (successRate / 100) * RING_C;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>virus-js — Audit Console</title>
<style>
${css()}
</style>
</head>
<body>
  <div class="shell">

    <header class="appbar">
      <div class="appbar-id">
        <span class="logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 2.5 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6l-8-3.5Z" />
            <path d="m8.5 12 2.3 2.3L15.7 9" />
          </svg>
        </span>
        <div class="appbar-text">
          <span class="appbar-title">virus-js</span>
          <span class="appbar-subtitle">Audit Console</span>
        </div>
      </div>
      <nav class="appbar-meta">
        <div class="meta-item">
          <span class="meta-label">Report generated</span>
          <span class="meta-value mono">${escapeHtml(nowIso())}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Sandbox root</span>
          <span class="meta-value mono trunc" title="${escapeHtml(sandboxRoot)}">${escapeHtml(sandboxRoot)}</span>
        </div>
      </nav>
    </header>

    <main>

      <section class="kpi-row" aria-label="System overview">
        <div class="kpi-card kpi-wide">
          <div class="kpi-card-head">
            <span class="kpi-label">Host</span>
            <span class="dot-live" aria-hidden="true"></span>
          </div>
          <div class="kpi-host">
            <span class="kpi-value">${escapeHtml(systemInfo.hostname)}</span>
            <span class="kpi-sub">${escapeHtml(systemInfo.osType)} ${escapeHtml(systemInfo.osRelease)} · ${escapeHtml(systemInfo.platform)}/${escapeHtml(systemInfo.arch)}</span>
          </div>
          <div class="kpi-host-grid">
            <div><span class="kpi-mini-label">Node</span><span class="mono kpi-mini-value">${escapeHtml(systemInfo.nodeVersion)}</span></div>
            <div><span class="kpi-mini-label">CPU</span><span class="mono kpi-mini-value">${escapeHtml(String(systemInfo.cpuCores))}-core</span></div>
            <div><span class="kpi-mini-label">Uptime</span><span class="mono kpi-mini-value">${escapeHtml(systemInfo.uptime)}</span></div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-head"><span class="kpi-label">Memory</span></div>
          <span class="kpi-value">${escapeHtml(systemInfo.freeMemory)}</span>
          <span class="kpi-sub">free of ${escapeHtml(systemInfo.totalMemory)}</span>
          ${memoryBar(systemInfo)}
        </div>

        <div class="kpi-card">
          <div class="kpi-card-head"><span class="kpi-label">Processor</span></div>
          <span class="kpi-value kpi-value-sm trunc" title="${escapeHtml(systemInfo.cpuModel)}">${escapeHtml(systemInfo.cpuModel)}</span>
          <span class="kpi-sub">${escapeHtml(String(systemInfo.cpuCores))} logical core${systemInfo.cpuCores === 1 ? '' : 's'}</span>
        </div>
      </section>

      <section class="grid-2">

        <div class="panel">
          <div class="panel-head">
            <div>
              <h2>Environment</h2>
              <p class="panel-desc">Fixed allowlist — never a raw <code class="mono">process.env</code> dump</p>
            </div>
          </div>
          <table class="data-table">
            <thead>
              <tr><th>Variable</th><th>Value</th></tr>
            </thead>
            <tbody>
              ${Object.entries(envInfo)
                .map(
                  ([k, v]) => `<tr>
                    <td class="mono cell-key">${escapeHtml(k)}</td>
                    <td class="mono cell-val ${v === 'not set' ? 'is-empty' : ''} trunc" title="${escapeHtml(v)}">${escapeHtml(v)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="panel">
          <div class="panel-head">
            <div>
              <h2>Audit summary</h2>
              <p class="panel-desc">Every CRUD attempt, accepted or rejected</p>
            </div>
          </div>

          ${
            total === 0
              ? emptyState('No CRUD actions logged yet.', 'Run a crud command to populate this report.')
              : `
          <div class="summary-row">
            <div class="ring-wrap">
              <svg viewBox="0 0 72 72" width="72" height="72" class="ring">
                <circle cx="36" cy="36" r="${RING_R}" class="ring-track" />
                <circle cx="36" cy="36" r="${RING_R}" class="ring-fill ${ringClass(successRate)}"
                  stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${ringOffset.toFixed(2)}" />
              </svg>
              <div class="ring-center">
                <span class="ring-num">${successRate}%</span>
                <span class="ring-lbl">pass</span>
              </div>
            </div>
            <div class="summary-stats">
              <div class="stat-line"><span class="stat-dot good"></span><span class="stat-num">${succeeded}</span><span class="stat-name">succeeded</span></div>
              <div class="stat-line"><span class="stat-dot bad"></span><span class="stat-num">${failed}</span><span class="stat-name">failed</span></div>
              <div class="stat-line"><span class="stat-dot warn"></span><span class="stat-num">${rejected}</span><span class="stat-name">sandbox-rejected</span></div>
              <div class="stat-line"><span class="stat-dot total"></span><span class="stat-num">${total}</span><span class="stat-name">total actions</span></div>
            </div>
          </div>

          <div class="action-dist">
            ${Object.entries(actionCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([action, count]) => actionBar(action, count, maxActionCount))
              .join('')}
          </div>`
          }
        </div>

      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Activity log</h2>
            <p class="panel-desc">Chronological record, most recent first</p>
          </div>
          <span class="count-chip">${total} ${total === 1 ? 'entry' : 'entries'}</span>
        </div>

        ${
          total === 0
            ? emptyState('Nothing recorded yet.', 'Entries appear here as CRUD commands run.')
            : `
        <table class="data-table log-table">
          <thead>
            <tr>
              <th class="col-status">Status</th>
              <th class="col-time">Timestamp</th>
              <th class="col-action">Action</th>
              <th class="col-target">Target</th>
              <th class="col-detail">Detail</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(logRow).join('')}
          </tbody>
        </table>`
        }
      </section>

    </main>

    <footer class="appfoot">
      <span>Static report · no network calls · no auto-refresh</span>
      <span class="mono">node index.js dashboard</span>
    </footer>

  </div>
</body>
</html>`;
}

function memoryBar(systemInfo) {
  const total = parseGb(systemInfo.totalMemory);
  const free = parseGb(systemInfo.freeMemory);
  if (total === null || free === null || total === 0) return '';
  const usedPct = Math.max(0, Math.min(100, Math.round(((total - free) / total) * 100)));
  return `<div class="mem-bar"><div class="mem-bar-fill" style="width:${usedPct}%"></div></div>
  <span class="mem-bar-label">${usedPct}% in use</span>`;
}

function parseGb(str) {
  const m = /^([\d.]+)\s*(B|KB|MB|GB|TB)$/i.exec(String(str ?? '').trim());
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  const mult = { B: 1 / 1024 ** 3, KB: 1 / 1024 ** 2, MB: 1 / 1024, GB: 1, TB: 1024 };
  return val * (mult[unit] ?? 1);
}

function ringClass(pct) {
  if (pct === null) return 'neutral';
  if (pct >= 80) return 'good';
  if (pct >= 50) return 'warn';
  return 'bad';
}

function actionBar(action, count, max) {
  const pct = Math.max(6, Math.round((count / max) * 100));
  return `<div class="action-row">
    <span class="mono action-label">${escapeHtml(action)}</span>
    <div class="action-track"><div class="action-fill" style="width:${pct}%"></div></div>
    <span class="mono action-count">${count}</span>
  </div>`;
}

function logRow(entry) {
  const status = entry.success ? 'good' : /rejected/i.test(entry.detail ?? '') ? 'warn' : 'bad';
  const statusLabel = entry.success ? 'OK' : /rejected/i.test(entry.detail ?? '') ? 'BLOCKED' : 'FAILED';
  const time = formatTime(entry.timestamp);
  const pathDisplay = entry.path ?? '—';
  return `<tr class="log-row">
    <td class="col-status"><span class="status-pill ${status}">${statusLabel}</span></td>
    <td class="col-time mono">${escapeHtml(time)}</td>
    <td class="col-action"><span class="action-tag">${escapeHtml(entry.action ?? '')}</span></td>
    <td class="col-target mono trunc" title="${escapeHtml(pathDisplay)}">${escapeHtml(pathDisplay)}</td>
    <td class="col-detail trunc" title="${escapeHtml(entry.detail ?? '')}">${entry.detail ? escapeHtml(entry.detail) : '<span class="is-empty">—</span>'}</td>
  </tr>`;
}

function emptyState(title, sub) {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M3.5 9.5h17" />
    </svg>
    <p class="empty-title">${escapeHtml(title)}</p>
    <p class="empty-sub">${escapeHtml(sub)}</p>
  </div>`;
}

function formatTime(iso) {
  if (!iso) return 'unknown';
  try {
    const d = new Date(iso);
    return d.toISOString().replace('T', ' ').replace('Z', '');
  } catch {
    return iso;
  }
}

function nowIso() {
  return new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function css() {
  return `
  :root {
    --bg: #F4F5F7;
    --surface: #FFFFFF;
    --surface-2: #FAFBFC;
    --ink: #14181F;
    --ink-soft: #3D4452;
    --muted: #6B7280;
    --line: #E3E6EB;
    --line-soft: #EDEFF2;
    --accent: #3454D1;
    --accent-soft: #EAEEFC;
    --good: #1A8754;
    --good-soft: #E5F5EC;
    --warn: #B5790A;
    --warn-soft: #FBF1DC;
    --bad: #C13434;
    --bad-soft: #FBEAEA;
    --radius: 8px;
    --radius-lg: 12px;
    --shadow: 0 1px 2px rgba(20,24,31,0.04), 0 1px 1px rgba(20,24,31,0.03);
    --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0B0D12;
      --surface: #12151C;
      --surface-2: #161A22;
      --ink: #E8EAED;
      --ink-soft: #B7BCC6;
      --muted: #7C8392;
      --line: #232831;
      --line-soft: #1C2027;
      --accent: #6C8CFF;
      --accent-soft: #1A2236;
      --good: #3DD68C;
      --good-soft: #122620;
      --warn: #E3AE4E;
      --warn-soft: #2A2212;
      --bad: #F0716A;
      --bad-soft: #2A1717;
      --shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
    line-height: 1.5;
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .mono { font-family: var(--mono); font-variant-ligatures: none; letter-spacing: -0.01em; }
  .trunc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .is-empty { color: var(--muted); }

  .shell { max-width: 1140px; margin: 0 auto; padding: 0 28px 64px; }

  /* ---------- App bar ---------- */
  .appbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 20px;
    padding: 22px 0;
    border-bottom: 1px solid var(--line);
    margin-bottom: 28px;
  }
  .appbar-id { display: flex; align-items: center; gap: 11px; }
  .logo {
    width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    background: var(--ink);
    color: var(--bg);
    border-radius: 8px;
    flex-shrink: 0;
  }
  .appbar-text { display: flex; flex-direction: column; line-height: 1.25; }
  .appbar-title { font-weight: 650; font-size: 15.5px; letter-spacing: -0.01em; }
  .appbar-subtitle { font-size: 12px; color: var(--muted); }

  .appbar-meta { display: flex; gap: 28px; flex-wrap: wrap; }
  .meta-item { display: flex; flex-direction: column; gap: 2px; max-width: 260px; }
  .meta-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
  .meta-value { font-size: 12.5px; color: var(--ink-soft); }

  main { display: flex; flex-direction: column; gap: 20px; }

  /* ---------- KPI row ---------- */
  .kpi-row {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr;
    gap: 16px;
  }
  .kpi-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    padding: 18px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .kpi-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; }
  .dot-live { width: 7px; height: 7px; border-radius: 50%; background: var(--good); box-shadow: 0 0 0 3px var(--good-soft); }
  .kpi-value { font-size: 19px; font-weight: 650; letter-spacing: -0.01em; }
  .kpi-value-sm { font-size: 14px; font-weight: 600; display: block; }
  .kpi-sub { font-size: 12px; color: var(--muted); }

  .kpi-host { margin-bottom: 10px; display: flex; flex-direction: column; gap: 2px; }
  .kpi-host-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--line-soft);
  }
  .kpi-host-grid > div { display: flex; flex-direction: column; gap: 2px; }
  .kpi-mini-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .kpi-mini-value { font-size: 13px; font-weight: 600; }

  .mem-bar { height: 5px; background: var(--line-soft); border-radius: 999px; overflow: hidden; margin-top: 10px; }
  .mem-bar-fill { height: 100%; background: var(--accent); border-radius: 999px; }
  .mem-bar-label { font-size: 11px; color: var(--muted); margin-top: 6px; }

  /* ---------- Panels ---------- */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  .panel {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    padding: 20px 22px 22px;
  }
  .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
  .panel-head h2 { margin: 0 0 3px; font-size: 14.5px; font-weight: 650; letter-spacing: -0.01em; }
  .panel-desc { margin: 0; font-size: 12px; color: var(--muted); }
  .panel-desc code { background: var(--surface-2); border: 1px solid var(--line-soft); padding: 0.05em 0.4em; border-radius: 4px; font-size: 0.95em; }

  .count-chip {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    background: var(--surface-2);
    border: 1px solid var(--line);
    padding: 4px 10px;
    border-radius: 999px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ---------- Tables (env + log) ---------- */
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table thead th {
    text-align: left;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    font-weight: 600;
    padding: 0 0 9px;
    border-bottom: 1px solid var(--line);
  }
  .data-table tbody td { padding: 9px 0; border-bottom: 1px solid var(--line-soft); font-size: 12.8px; vertical-align: middle; }
  .data-table tbody tr:last-child td { border-bottom: none; }
  .cell-key { color: var(--ink-soft); width: 36%; font-size: 12.3px; }
  .cell-val { max-width: 0; }

  .log-table thead th { padding-bottom: 10px; }
  .log-table .col-status { width: 84px; }
  .log-table .col-time { width: 190px; color: var(--muted); }
  .log-table .col-action { width: 96px; }
  .log-table .col-target { width: 26%; max-width: 0; color: var(--ink-soft); }
  .log-table .col-detail { color: var(--muted); max-width: 0; }
  .log-row td { font-size: 12.5px; }

  .status-pill {
    display: inline-flex;
    align-items: center;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 3px 8px;
    border-radius: 5px;
  }
  .status-pill.good { background: var(--good-soft); color: var(--good); }
  .status-pill.warn { background: var(--warn-soft); color: var(--warn); }
  .status-pill.bad { background: var(--bad-soft); color: var(--bad); }

  .action-tag {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--ink-soft);
    background: var(--surface-2);
    border: 1px solid var(--line);
    padding: 2.5px 8px;
    border-radius: 5px;
    letter-spacing: 0.02em;
  }

  /* ---------- Summary ring + stats (signature element) ---------- */
  .summary-row { display: flex; align-items: center; gap: 24px; margin-bottom: 18px; }
  .ring-wrap { position: relative; width: 72px; height: 72px; flex-shrink: 0; }
  .ring { transform: rotate(-90deg); }
  .ring-track { fill: none; stroke: var(--line-soft); stroke-width: 6; }
  .ring-fill { fill: none; stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 0.3s ease; }
  .ring-fill.good { stroke: var(--good); }
  .ring-fill.warn { stroke: var(--warn); }
  .ring-fill.bad { stroke: var(--bad); }
  .ring-fill.neutral { stroke: var(--muted); }
  .ring-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .ring-num { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; }
  .ring-lbl { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

  .summary-stats { display: flex; flex-direction: column; gap: 7px; flex: 1; min-width: 0; }
  .stat-line { display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; }
  .stat-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
  .stat-dot.good { background: var(--good); }
  .stat-dot.bad { background: var(--bad); }
  .stat-dot.warn { background: var(--warn); }
  .stat-dot.total { background: var(--muted); }
  .stat-num { font-family: var(--mono); font-weight: 700; min-width: 18px; }
  .stat-name { color: var(--muted); }

  .action-dist { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line-soft); }
  .action-row { display: grid; grid-template-columns: 64px 1fr 22px; gap: 10px; align-items: center; }
  .action-label { font-size: 11px; color: var(--muted); text-transform: uppercase; }
  .action-track { height: 5px; background: var(--line-soft); border-radius: 999px; overflow: hidden; }
  .action-fill { height: 100%; background: var(--accent); border-radius: 999px; }
  .action-count { font-size: 11px; color: var(--muted); text-align: right; }

  /* ---------- Empty state ---------- */
  .empty-state { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 20px 0 6px; color: var(--muted); }
  .empty-title { margin: 6px 0 0; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
  .empty-sub { margin: 0; font-size: 12px; }

  /* ---------- Footer ---------- */
  .appfoot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 28px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 11.5px;
  }
  .appfoot .mono { background: var(--surface-2); border: 1px solid var(--line); padding: 3px 9px; border-radius: 5px; }

  /* ---------- Responsive ---------- */
  @media (max-width: 880px) {
    .kpi-row { grid-template-columns: 1fr; }
    .grid-2 { grid-template-columns: 1fr; }
  }
  @media (max-width: 620px) {
    .shell { padding: 0 16px 48px; }
    .appbar-meta { flex-direction: column; gap: 10px; }
    .meta-item { max-width: 100%; }
    .kpi-host-grid { grid-template-columns: 1fr 1fr; row-gap: 10px; }
    .log-table thead { display: none; }
    .log-table, .log-table tbody, .log-table tr, .log-table td { display: block; width: 100%; max-width: none; }
    .log-row { padding: 10px 0; border-bottom: 1px solid var(--line-soft); }
    .log-row td { border-bottom: none; padding: 2px 0; overflow: visible; }
    .col-target, .col-detail { white-space: normal; overflow: visible; text-overflow: clip; }
    .col-time { color: var(--muted); font-size: 11.5px; }
    .col-target::before { content: "Target  "; color: var(--muted); font-family: var(--sans); font-size: 11px; }
    .col-detail::before { content: "Detail  "; color: var(--muted); font-family: var(--sans); font-size: 11px; }
  }
  `;
}
