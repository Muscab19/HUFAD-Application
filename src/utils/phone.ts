// src/utils/phone.ts

/**
 * Normalize a phone number to the canonical HUFAD format: 252XXXXXXXXX
 * Rules:
 *   "0611234567"     → "252611234567"
 *   "+252611234567"  → "252611234567"
 *   "252611234567"   → "252611234567"
 *   "00252611234567" → "252611234567"
 *   Anything else (username/email/letters) → returned trimmed, unchanged
 */
export const normalizePhone = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();

  // If it contains any letter or @, treat it as a username/email — leave it alone.
  if (/[a-zA-Z@]/.test(trimmed)) return trimmed;

  // Strip everything except digits
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;

  // Handle 00-prefixed international (e.g. 00252611234567)
  if (digits.startsWith('00')) digits = digits.slice(2);

  // Already in 252... form
  if (digits.startsWith('252')) return digits;

  // Local 0-prefixed → replace leading 0 with 252
  if (digits.startsWith('0')) return '252' + digits.slice(1);

  // Bare digits that look like a local number (e.g. "611234567") → prefix 252
  if (digits.length === 9) return '252' + digits;

  return digits;
};

/**
 * Quick check: does this look like it could be a phone number?
 * Used to decide keyboard type & placeholder hints.
 */
export const looksLikePhone = (input: string): boolean => {
  if (!input) return false;
  const trimmed = input.trim();
  if (/[a-zA-Z@]/.test(trimmed)) return false;
  return /\d/.test(trimmed);
};