#!/usr/bin/env node
/* eslint-disable max-params */
/* eslint-disable no-inner-declarations */
import core, { ExitCode } from '@actions/core';
// eslint-disable-next-line import/no-named-as-default
import Chalk from 'chalk';
// eslint-disable-next-line import/no-named-as-default
import simpleGit from 'simple-git';
import process from 'process';

let head;
let feature;
let path;
let diffFilter;
let similarity;
let isGithub;
let debug;
let checkFileNameDates;

// Allow running locally without core.getInput
if (process.env.CI === 'true') {
  isGithub = true;
  head = core.getInput('head', {
    required: true,
    description: 'The name of the branch to compare against',
    default: 'origin/main',
  });
  feature = core.getInput('feature', {
    required: true,
    description: 'The feature branch to compare against',
    default: 'dev',
  });
  path = core.getInput('path', {
    required: false,
    description: 'Path to compare, defaults to CWD',
    default: '',
  });
  similarity = core.getInput('similarity', {
    required: false,
    description: 'similarity (50 = 50%)',
    default: '50',
  });
  diffFilter = core.getInput('diffFilter', {
    required: false,
    description: 'Check for modified or renamed files (R|M|A|C|D|T|U|X|B|*), defaults to R (renamed)',
    default: 'R',
  });
  checkFileNameDates = core.getBooleanInput('checkFileNameDates', {
    required: false,
    description: 'Enables checking of dates in file names with the format VYYYY.MM.DD.NNNN, e.g. V2022.02.02.2024',
    default: false,
  });
  debug = core.getBooleanInput('debug', {
    required: false,
    description: 'Enables debug output',
    default: false,
  });
} else {
  isGithub = false;
  debug = false; // ENABLE DEBUG HERE
  checkFileNameDates = true;
  head = 'main'; // `origin/main`
  feature = 'dev'; //`dev`
  similarity = '50';
  diffFilter = 'R';
  path = '';
  process.env.GITHUB_WORKSPACE = process.cwd()
}

// if path is an empty string, use the GITHUB_WORKSPACE environment variable
if (path === '') {
  path = process.env.GITHUB_WORKSPACE;
}

async function run() {
  try {
    const git = simpleGit(path);

    const currentBranch = (await git.raw('rev-parse', '--abbrev-ref', 'HEAD')).trimEnd();

    if (currentBranch === head) {
      core.setFailed(`Current branch is ${JSON.stringify(currentBranch)}, you must run this on the branch you wish to check, e.g. ${feature}`);
      return ExitCode.Failure;
    }

    console.log(
      Chalk.green('[ Comparing HEAD:'),
      Chalk.bgGreen.bold(head),
      Chalk.green('and FEATURE:'),
      Chalk.bgBlue.bold(feature),
      Chalk.green('in PATH:'),
      Chalk.bgMagenta.bold(path),
      Chalk.green('with Filter:'),
      Chalk.bgYellow.bold(diffFilter),
      Chalk.green(']\n'),
    );

    if (isGithub) {
      // fetch and check out both refs
      await git.fetch(head);
      await git.fetch(feature);
      await git.checkout(head);
      await git.checkout(feature);
    }

    if (debug === true) {
      console.log(
        Chalk.red(
          '\n#### START DEBUG####\n',
          '\ndiffFilter = ' + diffFilter,
          '\nsimilarity = ' + similarity,
          '\nhead = ' + head,
          '\nfeature = ' + feature,
          '\n########',
          '\nworkspaces = ' + process.env.GITHUB_WORKSPACE,
          '\npath = ' + path,
          '\nprocess.cwd() = ' + process.cwd(),
          '\n########\n',
          '\ngit log:\n'),
        await git.log(),
        '\ngit status:\n',
        await git.status(),
        Chalk.red(
          '\n#### END DEBUG ####\n',
        ))
    }

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

    // Clean up modified files to ensure no false positives with empty lines
    const modifiedFiles = diff.trim().split('\n').filter(file => file !== '');

    if (modifiedFiles.length > 0) {
      const errorString = `ERROR ${modifiedFiles.length} modified files with filter ${diffFilter} found in ${path} !`
      core.setFailed(errorString);
      ExitCode.Failure;
      console.log(Chalk.red(
        errorString,
        '\n',
        'Files:',
        Chalk.bgRedBright(
          modifiedFiles)));
      core.setFailed(errorString);
      ExitCode.Failure;
    } else {
      console.log(Chalk.green(`No modified files with filter ${diffFilter} found in ${path}\n`));
    }

    if (checkFileNameDates) {
      // Extract the date from the filenames for each modified file (e.g. V2022.02.02.2024__my_db_migration_abc.sql)
      const modifiedFilesDate = modifiedFiles.map(file => {
        const date = file.match(/V(\d{4}\.\d{2}\.\d{2}\.\d{4})/);
        return date ? date[1] : null;
      }).filter(date => date !== null);

      // Compare the dates and alert if any are older than files on the head branch (e.g. V2022.02.02.2024 vs V2021.01.01.1111)
      const headFiles = await git.raw(['ls-tree', '-r', '--name-only', head, '--', path]);
      const headFilesDate = headFiles.split('\n').map(file => {
        const date = file.match(/V(\d{4}\.\d{2}\.\d{2}\.\d{4})/);
        return date ? date[1] : null;
      }).filter(date => date !== null);
      const olderFiles = modifiedFilesDate.filter(date => headFilesDate.includes(date) === false);
      if (olderFiles.length > 0) {
        const errorString = `ERROR ${olderFiles.length} modified files are older than files on the head branch !`
        console.log(Chalk.red(
          errorString,
          '\n',
          'Files:',
          Chalk.bgRedBright(
            olderFiles,
            '\n'),
          Chalk.green(
            'Head files:\n',
            headFilesDate,
          )));
        core.setFailed(errorString);
        ExitCode.Failure;
      } else {
        console.log(Chalk.green('No modified files are older than files on the head branch\n'));
      }
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
