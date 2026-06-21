/**
 * cli.js
 *
 * Wires together the system/env collectors, sandboxed CRUD module,
 * formatter, and exporter behind a commander-based CLI.
 *
 * Commands:
 *   node index.js info [--json]
 *   node index.js crud create <file> --content "..."
 *   node index.js crud read <file>
 *   node index.js crud update <file> --content "..." [--append] [--yes] [--dry-run]
 *   node index.js crud delete <file> [--yes] [--dry-run]
 */

import { Command } from 'commander';
import readline from 'readline';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';

import { collectSystemInfo } from './system/systemInfo.js';
import { collectEnvInfo } from './system/envInfo.js';
import { createFile, readFile, updateFile, deleteFile } from './fileOps/crud.js';
import { ensureRuntimeDirs, SANDBOX_ROOT, REPORTS_ROOT } from './fileOps/sandbox.js';
import { readAuditLog } from './audit/auditLogger.js';
import { printSystemInfo, printEnvInfo, printCrudResult, printSandboxBanner } from './output/formatter.js';
import { exportJsonReport } from './output/exporter.js';
import { renderDashboard } from './output/dashboard.js';

/** Prompts the user with a yes/no question on stdin. Resolves to boolean. */
function confirmPrompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.yellow(`${question} (y/N): `), (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

export async function run(argv) {
  await ensureRuntimeDirs();

  const program = new Command();
  program
    .name('virus-js')
    .description(
      'Educational, sandboxed system-info & file CRUD CLI utility (not malware).'
    )
    .option('--json', 'also export a JSON report to reports/');

  program
    .command('info')
    .description('Show system info and allowlisted environment variables')
    .action(async () => {
      const opts = program.opts();
      printSandboxBanner(SANDBOX_ROOT);

      const systemInfo = collectSystemInfo();
      const envInfo = collectEnvInfo();

      printSystemInfo(systemInfo);
      printEnvInfo(envInfo);

      if (opts.json) {
        const reportPath = await exportJsonReport({ systemInfo, envInfo });
        console.log(chalk.green(`\nJSON report written to: ${reportPath}`));
      }
    });

  program
    .command('dashboard')
    .description('Generate a static HTML dashboard summarizing system info, env vars, and the audit log')
    .action(async () => {
      const systemInfo = collectSystemInfo();
      const envInfo = collectEnvInfo();
      const auditLog = await readAuditLog();

      const html = renderDashboard({ systemInfo, envInfo, auditLog, sandboxRoot: SANDBOX_ROOT });

      await fs.mkdir(REPORTS_ROOT, { recursive: true });
      const target = path.join(REPORTS_ROOT, 'dashboard.html');
      await fs.writeFile(target, html, 'utf8');

      console.log(chalk.green(`Dashboard written to: ${target}`));
      console.log(chalk.dim('Open it in a browser to view (auto light/dark theme).'));
    });

  const crud = program.command('crud').description('Sandboxed file CRUD operations');

  crud
    .command('create <file>')
    .description('Create a new file inside the sandbox')
    .option('--content <text>', 'file content', '')
    .action(async (file, cmdOpts) => {
      const result = await createFile(file, cmdOpts.content);
      printCrudResult('create', file, result);
      await maybeExport(program, 'create', file, result);
    });

  crud
    .command('read <file>')
    .description('Read a file from the sandbox')
    .action(async (file) => {
      const result = await readFile(file);
      printCrudResult('read', file, result);
      await maybeExport(program, 'read', file, result);
    });

  crud
    .command('update <file>')
    .description('Update (overwrite or append to) a file in the sandbox')
    .option('--content <text>', 'new content', '')
    .option('--append', 'append instead of overwrite', false)
    .option('--yes', 'skip confirmation prompt', false)
    .option('--dry-run', 'show what would happen without doing it', false)
    .action(async (file, cmdOpts) => {
      let confirmed = cmdOpts.yes;
      if (!cmdOpts.dryRun && !confirmed) {
        const verb = cmdOpts.append ? 'append to' : 'overwrite';
        confirmed = await confirmPrompt(`About to ${verb} "${file}". Proceed?`);
      }

      const result = await updateFile(file, cmdOpts.content, {
        append: cmdOpts.append,
        dryRun: cmdOpts.dryRun,
        confirmed,
      });
      printCrudResult('update', file, result);
      await maybeExport(program, 'update', file, result);
    });

  crud
    .command('delete <file>')
    .description('Delete a file from the sandbox')
    .option('--yes', 'skip confirmation prompt', false)
    .option('--dry-run', 'show what would happen without doing it', false)
    .action(async (file, cmdOpts) => {
      let confirmed = cmdOpts.yes;
      if (!cmdOpts.dryRun && !confirmed) {
        confirmed = await confirmPrompt(`About to DELETE "${file}". This cannot be undone. Proceed?`);
      }

      const result = await deleteFile(file, { dryRun: cmdOpts.dryRun, confirmed });
      printCrudResult('delete', file, result);
      await maybeExport(program, 'delete', file, result);
    });

  await program.parseAsync(argv);
}

async function maybeExport(program, action, file, result) {
  const opts = program.opts();
  if (opts.json) {
    const reportPath = await exportJsonReport({ action, file, result });
    console.log(chalk.green(`\nJSON report written to: ${reportPath}`));
  }
}
