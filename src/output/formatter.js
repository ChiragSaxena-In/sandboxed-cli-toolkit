/**
 * formatter.js
 *
 * Renders collected data as pretty console tables with color coding:
 *   green  = success / present value
 *   yellow = warning / fallback ("N/A", "not set")
 *   red    = error / failure
 */

import chalk from 'chalk';
import Table from 'cli-table3';

const FALLBACK_VALUES = new Set(['N/A', 'not set']);
const MAX_DISPLAY_LENGTH = 80;

/**
 * Truncates long values (e.g. a sprawling PATH variable) so console
 * tables stay readable. The full, untruncated value is always still
 * written to the JSON export via exporter.js -- this only affects
 * what's printed to the terminal.
 */
function truncateForDisplay(str) {
  if (str.length <= MAX_DISPLAY_LENGTH) return str;
  return `${str.slice(0, MAX_DISPLAY_LENGTH)}... (truncated, see --json export for full value)`;
}

function colorValue(value) {
  const str = truncateForDisplay(String(value));
  if (FALLBACK_VALUES.has(str)) return chalk.yellow(str);
  return chalk.green(str);
}

function sectionHeader(title) {
  const bar = '─'.repeat(title.length + 4);
  console.log('\n' + chalk.bold.cyan(bar));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.bold.cyan(bar));
}

export function printSystemInfo(info) {
  sectionHeader('System Information');
  const table = new Table({ head: [chalk.bold('Field'), chalk.bold('Value')] });

  const rows = [
    ['OS Type', info.osType],
    ['OS Release', info.osRelease],
    ['OS Version', info.osVersion],
    ['Platform', info.platform],
    ['Architecture', info.arch],
    ['CPU Model', info.cpuModel],
    ['CPU Cores', info.cpuCores],
    ['Hostname', info.hostname],
    ['Node.js Version', info.nodeVersion],
    ['Home Directory', info.homeDir],
    ['Uptime', info.uptime],
    ['Total Memory', info.totalMemory],
    ['Free Memory', info.freeMemory],
  ];

  for (const [label, value] of rows) {
    table.push([label, colorValue(value)]);
  }
  console.log(table.toString());
}

export function printEnvInfo(envInfo) {
  sectionHeader('Allowlisted Environment Variables');
  console.log(
    chalk.dim(
      '  (Only an explicit allowlist is read -- never a full process.env dump. See README.)'
    )
  );
  const table = new Table({ head: [chalk.bold('Variable'), chalk.bold('Value')] });
  for (const [key, value] of Object.entries(envInfo)) {
    table.push([key, colorValue(value)]);
  }
  console.log(table.toString());
}

export function printCrudResult(action, userPath, result) {
  sectionHeader(`CRUD Operation Result: ${action.toUpperCase()}`);
  const table = new Table({ head: [chalk.bold('Field'), chalk.bold('Value')] });
  table.push(['Target', userPath]);
  table.push(['Success', result.success ? chalk.green('true') : chalk.red('false')]);

  if (result.success) {
    if (result.data?.dryRun) {
      table.push(['Mode', chalk.yellow('DRY RUN -- no changes made')]);
    }
    for (const [key, value] of Object.entries(result.data ?? {})) {
      if (key === 'dryRun') continue;
      if (key === 'content') {
        table.push([key, chalk.dim('(see content block below)')]);
      } else {
        table.push([key, chalk.green(String(value))]);
      }
    }
  } else {
    table.push(['Error', chalk.red(result.error)]);
  }
  console.log(table.toString());

  if (result.success && result.data?.content !== undefined) {
    console.log(chalk.bold('\nFile content:'));
    console.log(chalk.white(result.data.content));
  }
}

export function printSandboxBanner(sandboxRoot) {
  console.log(chalk.dim(`Sandbox root: ${sandboxRoot}`));
}
