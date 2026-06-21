#!/usr/bin/env node
/**
 * index.js
 *
 * Entry point. Delegates to src/cli.js. Installs a final safety net so
 * the process never crashes with an unhandled exception -- any truly
 * unexpected error is logged and the process exits cleanly instead.
 */

import { run } from './src/cli.js';
import chalk from 'chalk';

process.on('uncaughtException', (err) => {
  console.error(chalk.red('\n[fatal] Uncaught exception (process will exit cleanly):'));
  console.error(chalk.red(err?.stack || err?.message || String(err)));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('\n[fatal] Unhandled promise rejection (process will exit cleanly):'));
  console.error(chalk.red(reason?.stack || reason?.message || String(reason)));
  process.exit(1);
});

run(process.argv).catch((err) => {
  console.error(chalk.red('\n[fatal] CLI execution failed:'));
  console.error(chalk.red(err?.stack || err?.message || String(err)));
  process.exit(1);
});
