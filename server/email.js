import nodemailer from 'nodemailer';
import db from './db.js';

let transporter = null;

// Escape HTML to prevent XSS in email notifications
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

export async function sendConfirmationEmail(toEmail, submitterName, formName) {
  const settings = getSmtpSettings();
  if (!settings) return;

  const name = escapeHtml(submitterName || 'Customer');
  const form = escapeHtml(formName);

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;direction:ltr">
      <div style="background:#dc2626;padding:20px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">3D Tech</h1>
      </div>
      <div style="padding:24px;background:#fff;border:1px solid #eee;border-top:none">
        <h2 style="color:#333;margin-top:0">Thank you, ${name}!</h2>
        <p style="color:#555;line-height:1.6">
          We have received your <strong>${form}</strong> submission successfully.
          Our team will review your request and get back to you within 24-48 hours.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
        <h2 style="color:#333;margin-top:0;direction:rtl;text-align:right">شكراً لك، ${name}!</h2>
        <p style="color:#555;line-height:1.6;direction:rtl;text-align:right">
          لقد تلقينا طلبك بنجاح. سيقوم فريقنا بمراجعة طلبك والرد عليك خلال ٢٤-٤٨ ساعة.
        </p>
      </div>
      <div style="padding:16px;text-align:center;color:#999;font-size:12px;background:#f9f9f9;border-radius:0 0 8px 8px">
        3D Tech — Custom 3D Printing & Corporate Gifts
      </div>
    </div>
  `;

  await sendMail({
    to: toEmail,
    subject: `Thank you for your submission — 3D Tech | شكراً لتواصلك`,
    html,
    text: `Thank you ${submitterName || 'Customer'}! We received your ${formName} submission. We'll get back to you within 24-48 hours.\n\nشكراً لك! لقد تلقينا طلبك بنجاح. سنرد عليك خلال ٢٤-٤٨ ساعة.`,
  });
}

export async function sendFormNotification(formName, submissionData) {
  const settings = getSmtpSettings();
  if (!settings || !settings.notifyEmail) return;

  const fields = Object.entries(submissionData)
    .filter(([k]) => k !== '_hp')
    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:600;color:#555;border-bottom:1px solid #eee">${escapeHtml(k)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(v) || '—'}</td></tr>`)
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#333">New Submission: ${escapeHtml(formName)}</h2>
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
