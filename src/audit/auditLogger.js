/**
 * auditLogger.js
 *
 * Appends a structured, timestamped JSON-line entry to the audit log
 * for every CRUD action (success or failure). This is the tool's
 * accountability trail -- it is intentionally append-only and is never
 * exposed as a target of the CRUD module itself (see sandbox.js).
 */

import { promises as fs } from 'fs';
import { AUDIT_LOG_PATH, SANDBOX_ROOT } from '../fileOps/sandbox.js';

/**
 * @param {object} entry
 * @param {string} entry.action - e.g. "create" | "read" | "update" | "delete"
 * @param {string} entry.targetPath - absolute path the action targeted
 * @param {boolean} entry.success
 * @param {string} [entry.detail] - extra context (error message, mode, etc.)
 */
export async function logAuditEntry({ action, targetPath, success, detail }) {
  const record = {
    timestamp: new Date().toISOString(),
    action,
    // Store the path relative to the sandbox root for readability,
    // never an arbitrary absolute path from outside the sandbox.
    path: targetPath ? targetPath.replace(SANDBOX_ROOT, '.') : null,
    success,
    detail: detail ?? null,
  };

  const line = JSON.stringify(record) + '\n';

  try {
    await fs.appendFile(AUDIT_LOG_PATH, line, 'utf8');
  } catch (err) {
    // Audit logging must never crash the app. Surface to stderr instead.
    console.error('[audit-logger] Failed to write audit entry:', err.message);
  }

  return record;
}

/**
 * Reads back the audit log entries (used optionally for diagnostics).
 * Returns an empty array if the log doesn't exist yet.
 */
export async function readAuditLog() {
  try {
    const raw = await fs.readFile(AUDIT_LOG_PATH, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { malformed: true, raw: line };
        }
      });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
