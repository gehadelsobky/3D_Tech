import nodemailer from 'nodemailer';
import db from './db.js';

let transporter = null;

function getSmtpSettings() {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'smtp'").get();
  if (!row) return null;
  try {
    const settings = JSON.parse(row.value);
    if (!settings.host || !settings.port) return null;
    return settings;
  } catch {
    return null;
  }
}

function createTransporter(settings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: parseInt(settings.port),
    secure: settings.secure ?? (parseInt(settings.port) === 465),
    auth: settings.user ? { user: settings.user, pass: settings.pass } : undefined,
  });
}

export function refreshTransporter() {
  const settings = getSmtpSettings();
  if (settings) {
    transporter = createTransporter(settings);
  } else {
    transporter = null;
  }
  return transporter;
}

export async function sendMail({ to, subject, html, text }) {
  if (!transporter) refreshTransporter();
  if (!transporter) return { success: false, error: 'SMTP not configured' };

  const settings = getSmtpSettings();
  const from = settings?.from || settings?.user || 'noreply@example.com';

  try {
    const info = await transporter.sendMail({ from, to, subject, html, text });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function testConnection(settings) {
  const testTransporter = createTransporter(settings);
  try {
    await testTransporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendFormNotification(formName, submissionData) {
  const settings = getSmtpSettings();
  if (!settings || !settings.notifyEmail) return;

  const fields = Object.entries(submissionData)
    .filter(([k]) => k !== '_hp')
    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:600;color:#555;border-bottom:1px solid #eee">${k}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${v || '—'}</td></tr>`)
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#333">New Submission: ${formName}</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        ${fields}
      </table>
      <p style="color:#999;font-size:12px;margin-top:20px">Sent from 3DTech Admin</p>
    </div>
  `;

  await sendMail({
    to: settings.notifyEmail,
    subject: `New ${formName} Submission`,
    html,
    text: Object.entries(submissionData).filter(([k]) => k !== '_hp').map(([k, v]) => `${k}: ${v}`).join('\n'),
  });
}
