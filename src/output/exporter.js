/**
 * exporter.js
 *
 * Writes the full collected report (system info + env info + any CRUD
 * result) as a timestamped JSON file under the fixed REPORTS_ROOT
 * directory. The output path is always derived from REPORTS_ROOT and
 * a generated timestamp -- never from user input -- so there is no
 * path-injection surface here.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { REPORTS_ROOT } from '../fileOps/sandbox.js';

/**
 * @param {object} report - arbitrary JSON-serializable report data
 * @returns {Promise<string>} absolute path of the written report file
 */
export async function exportJsonReport(report) {
  await fs.mkdir(REPORTS_ROOT, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `report-${timestamp}.json`;
  const target = path.join(REPORTS_ROOT, fileName);

  const payload = {
    generatedAt: new Date().toISOString(),
    ...report,
  };

  await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
  return target;
}
