#!/usr/bin/env node
/* eslint-disable max-params */
/* eslint-disable no-inner-declarations */
import core from '@actions/core';
// eslint-disable-next-line import/no-named-as-default
import Chalk from 'chalk';
// eslint-disable-next-line import/no-named-as-default
import simpleGit from 'simple-git';

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
const path = core.getInput('path', {
  required: true,
  description: 'Path to check for changes',
  default: './',
});
const similarity = core.getInput('similarity', {
  required: true,
  description: 'similarity (50 = 50%)',
  default: '50',
});

// For stubbing purposes
// const feature = 'dev'
// const path = 'src/main/resources/db/migration/'
// const head = 'main'
// const similarity = '50'

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

    // fetch both branches
    await git.fetch(head);
    await git.fetch(feature);

    // diff two git branches for renamed files in the given path
    const diff = await git.diff([
      '--diff-filter=R',
      `--find-renames=${similarity}%`,
      head,
      '--',
      path,
      feature,
      '--',
      path,
    ]);
    console.log(diff);

    const modifiedFiles = diff.split('\n');

    if (modifiedFiles.length > 0) {
      core.setFailed(`ERROR: Renamed files found!\n ${modifiedFiles}`);
    } else {
      console.log(Chalk.green('No renamed files found in the path\n'));
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
