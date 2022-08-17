#!/usr/bin/env node
/* eslint-disable max-params */
/* eslint-disable no-inner-declarations */
import core from '@actions/core';
import Chalk from 'chalk';
import simpleGit from 'simple-git';
import process from 'process';

const head = core.getInput('head', {
  required: false,
  default: 'main',
});
const feature = core.getInput('feature', {
  required: false,
  default: 'dev',
});
const path = core.getInput('path', {
  required: false,
  default: 'src/main/resources/db/migration',
});

async function run() {
  try {

    const git = simpleGit(process.cwd());

    console.log(
      Chalk.green('[ Comparing HEAD:'),
      Chalk.bgGreen.bold(head),
      Chalk.green('and FEATURE:'),
      Chalk.bgBlue.bold(feature),
      Chalk.green('in PATH:'),
      Chalk.bgMagenta.bold(path),
      Chalk.green(']\n'),
    );

    const diff = await git.diff(['--name-status', head, feature, path]);
    // console.log(diff);

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

