#!/usr/bin/env node
/* eslint-disable max-params */
/* eslint-disable no-inner-declarations */
import core from '@actions/core';
import Chalk from 'chalk';
import simpleGit from 'simple-git';

const head = core.getInput('head', {
  required: true,
  default: 'main',
});
const feature = core.getInput('feature', {
  required: true,
  default: 'dev',
});
const path = core.getInput('path', {
  required: true,
  default: 'src/main/resources/db/migration',
});

// For stubbing purposes
// const feature = 'dev'
// const path = 'src/main/resources/db/migration'
// const head = 'main'

async function run() {
  try {

    const git = simpleGit(path);

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

    // diff two git branches and print only the file names
    const diff = await git.diff(['--name-only', '--', head, feature]);
    console.log(diff);

    const modifiedFiles = diff.split('\n').filter(line => line.startsWith('R'));

    if (modifiedFiles.length > 0) {
      console.log(Chalk.red('Renamed migrations:\n'));
      console.log(Chalk.red(modifiedFiles));
      core.setFailed('ERROR: Renamed database migrations found!');
    } else {
      console.log(Chalk.green('No renamed files found in the path\n'));
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

