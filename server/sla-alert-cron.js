/**
 * Overdue-submission alert — emails a digest of quote requests that are still
 * unanswered past the promised turnaround.
 *
 * Usage:
 *   node server/sla-alert-cron.js
 *
 * Scheduled hourly by PM2 in ecosystem.config.cjs. Each submission is reported
 * once (sla_alert_sent), so a backlog does not re-send every hour.
 */

import db from './db.js';
import { sendMail } from './email.js';
import { SLA_HOURS } from './sla.js';

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNotifyEmail() {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'smtp'").get();
  if (!row) return null;
  try {
    return JSON.parse(row.value).notifyEmail || null;
  } catch {
    return null;
  }
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] SLA alert: ${msg}`);
}

async function run() {
  const overdue = db.prepare(
    `SELECT fs.id, fs.data, fs.created_at, fd.name as form_name
     FROM form_submissions fs
     JOIN form_definitions fd ON fs.form_id = fd.id
     WHERE fs.status = 'new'
       AND fs.sla_alert_sent = 0
       AND fs.created_at <= datetime('now', ?)
     ORDER BY fs.created_at ASC`
  ).all(`-${SLA_HOURS} hours`);

  if (overdue.length === 0) {
    log('nothing overdue');
    return;
  }

  const notifyEmail = getNotifyEmail();
  if (!notifyEmail) {
    // Leave sla_alert_sent at 0 so these are picked up once SMTP is configured.
    log(`${overdue.length} overdue but no notification address configured — skipping`);
    return;
  }

  const rows = overdue.map((s) => {
    const data = JSON.parse(s.data);
    const hours = Math.floor((Date.now() - new Date(`${s.created_at.replace(' ', 'T')}Z`)) / 3600000);
    return `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(data.name) || '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(data.email) || '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(data.phone) || '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(s.form_name)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#E1222E;font-weight:600">${hours}h</td>
    </tr>`;
  }).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
      <h2 style="color:#E1222E">${overdue.length} quote request${overdue.length > 1 ? 's' : ''} past the ${SLA_HOURS}-hour turnaround</h2>
      <p style="color:#555">These are still marked <strong>New</strong> and have not been answered.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <tr style="background:#f7f7f7">
          <th style="padding:8px 12px;text-align:left">Name</th>
          <th style="padding:8px 12px;text-align:left">Email</th>
          <th style="padding:8px 12px;text-align:left">Phone</th>
          <th style="padding:8px 12px;text-align:left">Form</th>
          <th style="padding:8px 12px;text-align:left">Waiting</th>
        </tr>
        ${rows}
      </table>
      <p style="color:#999;font-size:12px;margin-top:20px">Sent from 3DTech Admin. Each request is reported once.</p>
    </div>
  `;

  const text = overdue.map((s) => {
    const data = JSON.parse(s.data);
    return `${data.name || '—'} | ${data.email || '—'} | ${data.phone || '—'} | ${s.form_name} | since ${s.created_at} UTC`;
  }).join('\n');

  const result = await sendMail({
    to: notifyEmail,
    subject: `⚠️ ${overdue.length} quote request${overdue.length > 1 ? 's' : ''} overdue (${SLA_HOURS}h+)`,
    html,
    text,
  });

  if (!result.success) {
    // Keep the flag unset so the next run retries instead of losing the alert.
    log(`send failed (${result.error}) — will retry next run`);
    process.exitCode = 1;
    return;
  }

  const markSent = db.prepare('UPDATE form_submissions SET sla_alert_sent = 1 WHERE id = ?');
  db.transaction(() => { for (const s of overdue) markSent.run(s.id); })();

  log(`alerted ${notifyEmail} about ${overdue.length} overdue submission(s)`);
}

run().catch((err) => {
  log(`FAILED: ${err.message}`);
  process.exit(1);
});
