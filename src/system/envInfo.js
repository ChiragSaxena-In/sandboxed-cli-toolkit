/**
 * envInfo.js
 *
 * SECURITY NOTE: This module deliberately does NOT enumerate or print
 * the full `process.env` object. Doing so risks leaking secrets
 * (API keys, tokens, credentials) that a real virus/infostealer would
 * be interested in -- exactly what this hackathon theme could tempt
 * a careless implementation into doing. Instead we read only a fixed,
 * explicit allowlist of harmless, informational variables.
 *
 * To add a variable to the report, add its name to ALLOWLISTED_ENV_VARS
 * below -- never read process.env dynamically by key from user input.
 */

export const ALLOWLISTED_ENV_VARS = [
  'PATH',
  'Path', // Windows casing
  'USER',
  'USERNAME', // Windows
  'HOME',
  'USERPROFILE', // Windows
  'SHELL',
  'LANG',
  'NODE_ENV',
];

/**
 * Collects only the allowlisted environment variables.
 * Missing variables are reported as "not set" rather than omitted,
 * so the report shape is always predictable. Never throws.
 *
 * @returns {Record<string, string>}
 */
export function collectEnvInfo() {
  const result = {};
  // De-duplicate cross-platform aliases (e.g. PATH vs Path) into one
  // logical key in the output where possible, but still only ever
  // touch allowlisted names.
  for (const key of ALLOWLISTED_ENV_VARS) {
    try {
      const value = process.env[key];
      result[key] = value === undefined || value === '' ? 'not set' : value;
    } catch {
      result[key] = 'not set';
    }
  }
  return result;
}
