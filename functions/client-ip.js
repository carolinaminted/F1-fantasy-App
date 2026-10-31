// Google's front end appends the address it received the connection from to X-Forwarded-For.
// Everything before that is whatever the caller sent, so only entries counted from the end can
// be trusted. Verified against staging after deploy; see [SEC-05].
const TRUSTED_HOPS = 1;

/**
 * The caller's IP for rate limiting. Reading the first X-Forwarded-For entry let a client
 * forge a fresh rate-limit bucket on every request with one header.
 */
const resolveClientIp = (headers, fallbackIp, trustedHops = TRUSTED_HOPS) => {
  const raw = headers?.['x-forwarded-for'];
  const header = Array.isArray(raw) ? raw.join(',') : raw;
  if (header) {
    const hops = header.split(',').map(h => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[Math.max(hops.length - trustedHops, 0)];
  }
  return fallbackIp || 'unknown';
};

module.exports = { TRUSTED_HOPS, resolveClientIp };
