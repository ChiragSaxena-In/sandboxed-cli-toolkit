/**
 * systemInfo.js
 *
 * Collects general system information. Every individual data point is
 * wrapped in its own try/catch so a single failing call (e.g. on an
 * unusual platform) can never take down the whole report -- it just
 * falls back to "N/A".
 */

import os from 'os';

const NA = 'N/A';

/** Safely invoke a zero-arg function, returning NA on any throw. */
function safe(fn) {
  try {
    const value = fn();
    return value === undefined || value === null || value === '' ? NA : value;
  } catch {
    return NA;
  }
}

/** Format bytes into a human-readable string (e.g. "16.0 GB"). */
function formatBytes(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return NA;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/** Format seconds into a human-readable uptime string. */
function formatUptime(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return NA;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

/**
 * Collects CPU summary info (model + core count) without throwing,
 * even if os.cpus() returns an empty array on some platforms.
 */
function collectCpuSummary() {
  try {
    const cpus = os.cpus();
    if (!Array.isArray(cpus) || cpus.length === 0) {
      return { model: NA, cores: 0 };
    }
    return {
      model: cpus[0]?.model ?? NA,
      cores: cpus.length,
    };
  } catch {
    return { model: NA, cores: 0 };
  }
}

/**
 * Top-level collector. Returns a flat, formatter-friendly object.
 * Never throws -- every field independently falls back to "N/A".
 */
export function collectSystemInfo() {
  const cpu = collectCpuSummary();

  return {
    osType: safe(() => os.type()),
    osRelease: safe(() => os.release()),
    osVersion: safe(() => (typeof os.version === 'function' ? os.version() : NA)),
    platform: safe(() => os.platform()),
    arch: safe(() => os.arch()),
    cpuModel: cpu.model,
    cpuCores: cpu.cores,
    hostname: safe(() => os.hostname()),
    nodeVersion: safe(() => process.version),
    homeDir: safe(() => os.homedir()),
    uptime: safe(() => formatUptime(os.uptime())),
    totalMemory: safe(() => formatBytes(os.totalmem())),
    freeMemory: safe(() => formatBytes(os.freemem())),
  };
}
