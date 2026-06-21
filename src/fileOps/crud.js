/**
 * crud.js
 *
 * Implements Create / Read / Update / Delete, each:
 *   1. Resolves & validates the target path via resolveSandboxPath()
 *      (throws SandboxViolationError on any escape attempt).
 *   2. Performs the operation with fs/promises (async, non-blocking).
 *   3. Catches filesystem errors (ENOENT, EACCES/EPERM, etc.) and
 *      returns a uniform { success, error?, data? } shape -- never throws
 *      out of these functions for ordinary I/O failures.
 *   4. Logs the outcome to the audit log.
 *
 * Destructive operations (update-overwrite, delete) support --dry-run
 * (no filesystem mutation, just reports intent) and an explicit
 * confirmation gate that the CLI layer enforces via --yes or an
 * interactive prompt.
 */

import { promises as fs } from 'fs';
import { resolveSandboxPath, SandboxViolationError } from './sandbox.js';
import { logAuditEntry } from '../audit/auditLogger.js';

/** Uniform success/error result shape used by every CRUD function. */
function ok(data) {
  return { success: true, data };
}
function fail(error) {
  return { success: false, error };
}

/** Translates common Node fs error codes into friendly messages. */
function describeFsError(err) {
  switch (err.code) {
    case 'ENOENT':
      return 'File not found.';
    case 'EACCES':
    case 'EPERM':
      return 'Permission denied.';
    case 'EISDIR':
      return 'Target is a directory, not a file.';
    case 'EEXIST':
      return 'File already exists.';
    default:
      return err.message || 'Unknown filesystem error.';
  }
}

/**
 * CREATE: writes a new file. Fails if the file already exists, to
 * avoid silently clobbering data (use update --overwrite for that).
 */
export async function createFile(userPath, content = '') {
  let target;
  try {
    target = resolveSandboxPath(userPath);
  } catch (err) {
    if (err instanceof SandboxViolationError) {
      await logAuditEntry({ action: 'create', targetPath: null, success: false, detail: err.message });
      return fail(err.message);
    }
    throw err;
  }

  try {
    await fs.writeFile(target, content, { encoding: 'utf8', flag: 'wx' });
    await logAuditEntry({ action: 'create', targetPath: target, success: true });
    return ok({ path: target, bytesWritten: Buffer.byteLength(content, 'utf8') });
  } catch (err) {
    const message = describeFsError(err);
    await logAuditEntry({ action: 'create', targetPath: target, success: false, detail: message });
    return fail(message);
  }
}

/** READ: returns file content. */
export async function readFile(userPath) {
  let target;
  try {
    target = resolveSandboxPath(userPath);
  } catch (err) {
    if (err instanceof SandboxViolationError) {
      await logAuditEntry({ action: 'read', targetPath: null, success: false, detail: err.message });
      return fail(err.message);
    }
    throw err;
  }

  try {
    const content = await fs.readFile(target, 'utf8');
    await logAuditEntry({ action: 'read', targetPath: target, success: true });
    return ok({ path: target, content });
  } catch (err) {
    const message = describeFsError(err);
    await logAuditEntry({ action: 'read', targetPath: target, success: false, detail: message });
    return fail(message);
  }
}

/**
 * UPDATE: appends to or overwrites an existing file.
 *
 * @param {string} userPath
 * @param {string} content
 * @param {object} opts
 * @param {boolean} [opts.append=false] - append instead of overwrite
 * @param {boolean} [opts.dryRun=false] - report intent only, no write
 * @param {boolean} [opts.confirmed=false] - required true for overwrite
 *        to actually execute when dryRun is false (CLI layer gates this
 *        via --yes or an interactive prompt before calling with confirmed:true)
 */
export async function updateFile(userPath, content = '', opts = {}) {
  const { append = false, dryRun = false, confirmed = false } = opts;
  let target;
  try {
    target = resolveSandboxPath(userPath);
  } catch (err) {
    if (err instanceof SandboxViolationError) {
      await logAuditEntry({ action: 'update', targetPath: null, success: false, detail: err.message });
      return fail(err.message);
    }
    throw err;
  }

  // Confirm the file exists first (update should not silently create).
  try {
    await fs.access(target);
  } catch {
    const message = 'File not found. Use "create" for new files.';
    await logAuditEntry({ action: 'update', targetPath: target, success: false, detail: message });
    return fail(message);
  }

  if (dryRun) {
    const detail = `[dry-run] Would ${append ? 'append to' : 'overwrite'} this file.`;
    await logAuditEntry({ action: 'update', targetPath: target, success: true, detail });
    return ok({ path: target, dryRun: true, mode: append ? 'append' : 'overwrite' });
  }

  if (!confirmed) {
    const message = 'Update not confirmed. Pass --yes or confirm the prompt to proceed.';
    await logAuditEntry({ action: 'update', targetPath: target, success: false, detail: message });
    return fail(message);
  }

  try {
    await fs.writeFile(target, content, { encoding: 'utf8', flag: append ? 'a' : 'w' });
    await logAuditEntry({
      action: 'update',
      targetPath: target,
      success: true,
      detail: `mode=${append ? 'append' : 'overwrite'}`,
    });
    return ok({ path: target, mode: append ? 'append' : 'overwrite' });
  } catch (err) {
    const message = describeFsError(err);
    await logAuditEntry({ action: 'update', targetPath: target, success: false, detail: message });
    return fail(message);
  }
}

/**
 * DELETE: removes a file from the sandbox.
 *
 * @param {string} userPath
 * @param {object} opts
 * @param {boolean} [opts.dryRun=false]
 * @param {boolean} [opts.confirmed=false]
 */
export async function deleteFile(userPath, opts = {}) {
  const { dryRun = false, confirmed = false } = opts;
  let target;
  try {
    target = resolveSandboxPath(userPath);
  } catch (err) {
    if (err instanceof SandboxViolationError) {
      await logAuditEntry({ action: 'delete', targetPath: null, success: false, detail: err.message });
      return fail(err.message);
    }
    throw err;
  }

  try {
    await fs.access(target);
  } catch {
    const message = 'File not found.';
    await logAuditEntry({ action: 'delete', targetPath: target, success: false, detail: message });
    return fail(message);
  }

  if (dryRun) {
    const detail = '[dry-run] Would delete this file.';
    await logAuditEntry({ action: 'delete', targetPath: target, success: true, detail });
    return ok({ path: target, dryRun: true });
  }

  if (!confirmed) {
    const message = 'Delete not confirmed. Pass --yes or confirm the prompt to proceed.';
    await logAuditEntry({ action: 'delete', targetPath: target, success: false, detail: message });
    return fail(message);
  }

  try {
    await fs.unlink(target);
    await logAuditEntry({ action: 'delete', targetPath: target, success: true });
    return ok({ path: target });
  } catch (err) {
    const message = describeFsError(err);
    await logAuditEntry({ action: 'delete', targetPath: target, success: false, detail: message });
    return fail(message);
  }
}
