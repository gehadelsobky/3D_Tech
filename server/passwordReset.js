import crypto from 'crypto';

/**
 * Password-reset links.
 *
 * A link is a single-use, time-limited token. The token itself is emailed; only
 * its SHA-256 hash is stored, so a leaked database cannot be used to reset
 * anyone's password — the same reasoning as api_keys.
 */
export const RESET_TOKEN_TTL_MINUTES = 30;

/** A URL-safe 256-bit token. Far beyond guessing range. */
export function generateResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/** SHA-256 is right here (not bcrypt): the input is already high-entropy, and
 *  lookup must be a fast indexed match rather than a per-row comparison. */
export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Base URL for the link in the email.
 *
 * Deliberately NOT derived from the request Host header in production: that
 * header is attacker-controlled, and a password-reset link is exactly what you
 * do not want pointed at someone else's domain. Set PUBLIC_URL in production.
 * Returns null when it cannot be resolved safely, and the caller declines to
 * send rather than sending a link it cannot vouch for.
 */
export function getResetBaseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') return null;
  return `${req.protocol}://${req.get('host')}`;
}
