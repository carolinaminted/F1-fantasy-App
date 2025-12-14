
// Basic list of reserved words and common profanity to block from public leaderboards
const BLACKLIST = [
  'admin', 'administrator', 'mod', 'moderator', 'system', 'root', 'support',
  'fuck', 'shit', 'piss', 'cunt', 'bitch', 'asshole', 'dick', 'cock', 'pussy', 'nigger', 'faggot', 'whore', 'slut'
];

export const sanitizeString = (str: string): string => {
  return str.trim();
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const validateDisplayName = (name: string): ValidationResult => {
  const sanitized = sanitizeString(name);
  
  if (!sanitized) return { valid: false, error: "Display name cannot be empty." };
  if (sanitized.length > 20) return { valid: false, error: "Display name must be 20 characters or less." };
  if (sanitized.length < 3) return { valid: false, error: "Display name must be at least 3 characters." };
  
  // Allow alphanumeric, spaces, underscores, hyphens, dots
  const regex = /^[a-zA-Z0-9 _\-\.]+$/;
  if (!regex.test(sanitized)) {
    return { valid: false, error: "Display name contains invalid characters." };
  }

  // Check Blacklist
  const lower = sanitized.toLowerCase();
  if (BLACKLIST.some(word => lower.includes(word))) {
    return { valid: false, error: "Display name contains restricted words." };
  }

  return { valid: true };
};

export const validateRealName = (name: string, label: string): ValidationResult => {
  const sanitized = sanitizeString(name);
  
  if (!sanitized) return { valid: false, error: `${label} cannot be empty.` };
  if (sanitized.length > 50) return { valid: false, error: `${label} must be 50 characters or less.` };
  
  // Allow letters, spaces, hyphens, apostrophes (O'Connor, Jean-Luc)
  // \p{L} matches any unicode letter
  const regex = /^[a-zA-Z\u00C0-\u00FF '.\-]+$/;
  if (!regex.test(sanitized)) {
    return { valid: false, error: `${label} contains invalid characters.` };
  }

  return { valid: true };
};
