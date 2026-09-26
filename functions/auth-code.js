const MAX_FAILED_ATTEMPTS = 5;

/**
 * Decides the outcome of one guess against a stored email verification code. A 6-digit code
 * has only 900,000 values, so the cap on wrong guesses per code — not the IP rate limit, which
 * rotating IPs defeat — is what makes brute-forcing it impractical.
 *
 * `action` tells the caller what to do with the stored record: `delete` it, `increment` its
 * failure count, or leave it alone (`none`).
 */
const evaluateCodeAttempt = (record, code, nowMs) => {
  if (!record) return { valid: false, message: 'Code not found', action: 'none' };
  if (nowMs > record.expiresAt) return { valid: false, message: 'Code expired', action: 'delete' };
  if (record.code === code) return { valid: true, action: 'delete' };

  const failedAttempts = (record.failedAttempts || 0) + 1;
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      valid: false,
      message: 'Too many incorrect attempts. Please request a new code.',
      action: 'delete',
    };
  }
  return { valid: false, message: 'Invalid code', action: 'increment', failedAttempts };
};

module.exports = { MAX_FAILED_ATTEMPTS, evaluateCodeAttempt };
