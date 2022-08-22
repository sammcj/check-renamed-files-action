#!/usr/bin/env node
/* eslint-disable max-params */
/* eslint-disable no-inner-declarations */
import core, { ExitCode } from '@actions/core';
// eslint-disable-next-line import/no-named-as-default
import Chalk from 'chalk';
// eslint-disable-next-line import/no-named-as-default
import simpleGit from 'simple-git';
import process from 'process';

const head = core.getInput('head', {
  required: true,
  description: 'The name of the branch to compare against',
  default: 'main',
});
const feature = core.getInput('feature', {
  required: true,
  description: 'The feature branch to compare against',
  default: 'dev',
});
var path = core.getInput('path', {
  required: false,
  description: 'Path to compare, defaults to CWD',
  default: process.cwd(),
});
const similarity = core.getInput('similarity', {
  required: true,
  description: 'similarity (50 = 50%)',
  default: '50',
});
const diffFilter = core.getInput('mode', {
  required: false,
  description: 'Check for modified or renamed files (R|M|A|C|D|T|U|X|B|*), defaults to R (renamed)',
  default: 'R',
});

// For stubbing purposes
// const feature = 'dev'
// const path = process.cwd();
// const head = 'main'
// const similarity = '50'
// const diffFilter = 'R'

async function run() {
  try {
    const git = simpleGit();

    console.log(
      Chalk.green('[ Comparing HEAD:'),
      Chalk.bgGreen.bold(head),
      Chalk.green('and FEATURE:'),
      Chalk.bgBlue.bold(feature),
      Chalk.green('in PATH:'),
      Chalk.bgMagenta.bold(path),
      Chalk.green(']\n'),
    );

    // // fetch both branches
    await git.fetch(head);
    await git.fetch(feature);

    // diff two git branches for renamed files in the given path
    const diff = await git.diff([
      '--name-only',
      `--diff-filter=${diffFilter}`,
      `--find-renames=${similarity}%`,
      head,
      feature,
      '--',
      path,
    ]);
    console.log(diff);

    const modifiedFiles = diff.trim().split('\n');
    const modifiedFilesArray = modifiedFiles.map((file) => file.split('\n'));

    if (modifiedFiles.length > 0) {
      core.setOutput(`modified files with filter ${diffFilter} found in ${path}:`, modifiedFilesArray);
      console.log(modifiedFilesArray);
      core.setFailed(`ERROR: ${modifiedFiles.length} Modified files with filter ${diffFilter} found in ${path} !`);
      ExitCode.Failure;
    } else {
      console.log(Chalk.green(`No modified files with filter ${diffFilter} found in ${path}\n`));
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
