/**
 * sandbox.js
 *
 * Centralizes the sandbox root path and provides the ONLY function
 * (`resolveSandboxPath`) that the rest of the app is allowed to use
 * to turn a user-supplied filename into an actual filesystem path.
 *
 * Security contract:
 *   - The sandbox root is a fixed constant, never derived from user input.
 *   - Every candidate path is resolved with path.resolve() and then
 *     checked to ensure it still lives inside the sandbox root.
 *   - Any attempt to escape (via "..", absolute paths, symlink-y tricks,
 *     null bytes, etc.) is REJECTED, not silently corrected. We never
 *     try to "fix" a bad path back into the sandbox -- that would hide
 *     malicious intent. We log the attempt and throw.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sandbox root is always the literal "sandbox" directory at the project root.
// This is a constant -- never built from process.argv, process.env, or any
// other user-controllable input.
export const SANDBOX_ROOT = path.resolve(__dirname, '..', '..', 'sandbox');
export const REPORTS_ROOT = path.resolve(__dirname, '..', '..', 'reports');
export const AUDIT_LOG_PATH = path.join(SANDBOX_ROOT, '.audit.log');

/**
 * Custom error type so callers can distinguish "tried to escape the
 * sandbox" from ordinary filesystem errors (ENOENT, EACCES, etc.).
 */
export class SandboxViolationError extends Error {
  constructor(message, attemptedPath) {
    super(message);
    this.name = 'SandboxViolationError';
    this.attemptedPath = attemptedPath;
  }
}

/**
 * Ensures the sandbox and reports directories exist. Safe to call on
 * every startup; no-ops if they already exist.
 */
export async function ensureRuntimeDirs() {
  await fs.mkdir(SANDBOX_ROOT, { recursive: true });
  await fs.mkdir(REPORTS_ROOT, { recursive: true });
}

/**
 * Resolves a user-supplied filename/relative-path to an absolute path
 * that is guaranteed to live inside SANDBOX_ROOT.
 *
 * Rejects (throws SandboxViolationError) on:
 *   - empty/non-string input
 *   - absolute paths (e.g. "/etc/passwd", "C:\\Windows\\...")
 *   - any path containing a literal ".." traversal segment
 *   - null bytes (a classic path-injection trick)
 *   - any resolved path that does not start with SANDBOX_ROOT + sep
 *
 * @param {string} userPath - filename or relative path requested by the user
 * @returns {string} absolute, validated path inside the sandbox
 */
export function resolveSandboxPath(userPath) {
  if (typeof userPath !== 'string' || userPath.trim() === '') {
    throw new SandboxViolationError(
      'A non-empty file path is required.',
      userPath
    );
  }

  if (userPath.includes('\0')) {
    throw new SandboxViolationError(
      'Rejected: path contains a null byte.',
      userPath
    );
  }

  if (path.isAbsolute(userPath)) {
    throw new SandboxViolationError(
      'Rejected: absolute paths are not allowed. Provide a path relative to the sandbox.',
      userPath
    );
  }

  // Reject any literal ".." traversal segment outright (defense in depth,
  // in addition to the resolved-path check below).
  const segments = userPath.split(/[\\/]/);
  if (segments.includes('..')) {
    throw new SandboxViolationError(
      'Rejected: ".." path traversal is not allowed.',
      userPath
    );
  }

  const candidate = path.resolve(SANDBOX_ROOT, userPath);

  // Final authoritative check: the resolved path must be the sandbox root
  // itself, or a path nested inside it.
  const withSep = SANDBOX_ROOT.endsWith(path.sep)
    ? SANDBOX_ROOT
    : SANDBOX_ROOT + path.sep;

  if (candidate !== SANDBOX_ROOT && !candidate.startsWith(withSep)) {
    throw new SandboxViolationError(
      'Rejected: resolved path escapes the sandbox root.',
      userPath
    );
  }

  // Disallow direct manipulation of the audit log itself via CRUD ops.
  if (candidate === AUDIT_LOG_PATH) {
    throw new SandboxViolationError(
      'Rejected: the audit log file cannot be modified via CRUD operations.',
      userPath
    );
  }

  return candidate;
}
