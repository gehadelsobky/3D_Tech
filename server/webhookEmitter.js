import crypto from 'crypto';
import db from './db.js';

const RETRY_DELAYS = [1000, 4000, 16000]; // 1s, 4s, 16s
const TIMEOUT_MS = 10000;

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function deliverWebhook(webhook, event, payload, deliveryId, attempt = 0) {
  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
  const signature = sign(body, webhook.secret);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event,
        'User-Agent': '3DTech-Webhook/1.0',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text().catch(() => '');
    const success = response.ok ? 1 : 0;

    db.prepare(`
      UPDATE webhook_deliveries SET response_status = ?, response_body = ?, success = ?, attempts = ?, last_attempt_at = datetime('now')
      WHERE id = ?
    `).run(response.status, responseBody.slice(0, 1000), success, attempt + 1, deliveryId);

    // Retry on server errors (5xx)
    if (!response.ok && response.status >= 500 && attempt < RETRY_DELAYS.length - 1) {
      setTimeout(() => deliverWebhook(webhook, event, payload, deliveryId, attempt + 1), RETRY_DELAYS[attempt]);
    }
  } catch (err) {
    const errorMsg = err.name === 'AbortError' ? 'Request timed out' : err.message;

    db.prepare(`
      UPDATE webhook_deliveries SET response_status = 0, response_body = ?, success = 0, attempts = ?, last_attempt_at = datetime('now')
      WHERE id = ?
    `).run(errorMsg.slice(0, 1000), attempt + 1, deliveryId);

    // Retry on network errors
    if (attempt < RETRY_DELAYS.length - 1) {
      setTimeout(() => deliverWebhook(webhook, event, payload, deliveryId, attempt + 1), RETRY_DELAYS[attempt]);
    }
  }
}

export function emitEvent(event, payload) {
  try {
    const webhooks = db.prepare(
      "SELECT * FROM webhooks WHERE is_active = 1"
    ).all();

    for (const webhook of webhooks) {
      const events = JSON.parse(webhook.events);
      if (!events.includes(event)) continue;

      // Create delivery record
      const result = db.prepare(
        "INSERT INTO webhook_deliveries (webhook_id, event, payload) VALUES (?, ?, ?)"
      ).run(webhook.id, event, JSON.stringify(payload));

      // Fire async delivery (non-blocking)
      deliverWebhook(webhook, event, payload, result.lastInsertRowid).catch(() => {});
    }
  } catch {
    // Never let webhook errors break the main request
  }
}

export async function sendTestPing(webhookId) {
  const webhook = db.prepare("SELECT * FROM webhooks WHERE id = ?").get(webhookId);
  if (!webhook) throw new Error('Webhook not found');

  const event = 'webhook.test';
  const payload = { message: 'This is a test ping from 3DTech' };
  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
  const signature = sign(body, webhook.secret);

  const result = db.prepare(
    "INSERT INTO webhook_deliveries (webhook_id, event, payload) VALUES (?, ?, ?)"
  ).run(webhook.id, event, JSON.stringify(payload));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event,
        'User-Agent': '3DTech-Webhook/1.0',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseBody = await response.text().catch(() => '');

    db.prepare(`
      UPDATE webhook_deliveries SET response_status = ?, response_body = ?, success = ?, attempts = 1, last_attempt_at = datetime('now')
      WHERE id = ?
    `).run(response.status, responseBody.slice(0, 1000), response.ok ? 1 : 0, result.lastInsertRowid);

    return { success: response.ok, status: response.status, body: responseBody.slice(0, 500) };
  } catch (err) {
    const errorMsg = err.name === 'AbortError' ? 'Request timed out' : err.message;

    db.prepare(`
      UPDATE webhook_deliveries SET response_status = 0, response_body = ?, success = 0, attempts = 1, last_attempt_at = datetime('now')
      WHERE id = ?
    `).run(errorMsg, result.lastInsertRowid);

    return { success: false, status: 0, body: errorMsg };
  }
}
