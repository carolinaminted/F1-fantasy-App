const MAX_EMAIL_LENGTH = 254;

// One address only: nodemailer's `to:` accepts comma-separated lists and display-name syntax,
// so anything that could be read as more than one recipient is refused outright.
const SINGLE_ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/** Lowercased address, or `null` when the input is not exactly one plausible address. */
const normalizeEmail = (raw) => {
  if (typeof raw !== 'string') return null;
  const email = raw.trim();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return null;
  if (!SINGLE_ADDRESS.test(email)) return null;
  return email.toLowerCase();
};

module.exports = { MAX_EMAIL_LENGTH, normalizeEmail };
