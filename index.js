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

// Allow running locally without core.getInput
if (process.env.GITHUB_WORKSPACE) {
  isGithub = true;
  head = core.getInput('head', {
    required: true,
    description: 'The name of the branch to compare against',
    default: 'main',
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
  debug = core.getBooleanInput('debug', {
    required: false,
    description: 'Enables debug output',
    default: false,
  });
} else {
  isGithub = false;
  debug = false; // ENABLE DEBUG HERE
  head = 'main'; // `origin/main`
  feature = 'dev'; //`origin/dev`
  similarity = '50';
  diffFilter = 'M';
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

    const currentBranch = await (await git.raw('rev-parse', '--abbrev-ref', 'HEAD')).trimEnd();

    if (currentBranch !== feature) {
      core.setFailed(`Current branch is ${JSON.stringify(currentBranch)}, expected ${feature}`);
      return ExitCode.Failure;
    }

    console.log(
      Chalk.green('[ Comparing HEAD:'),
      Chalk.bgGreen.bold(head),
      Chalk.green('and FEATURE:'),
      Chalk.bgBlue.bold(feature),
      Chalk.green('in PATH:'),
      Chalk.bgMagenta.bold(path),
      Chalk.green(']\n'),
    );

    if (isGithub) {
      // fetch both refs
      await git.fetch(head);
      await git.fetch(feature);
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

    // Alert if there are any modified files with the given filter
    const modifiedFiles = diff.trim().split('\n')

    if (modifiedFiles.length > 0) {
      const errorString = `ERROR ${modifiedFiles.length} modified files with filter ${diffFilter} found in ${path} !`
      console.log(errorString, '\n', modifiedFiles);
      core.setFailed(errorString);
      ExitCode.Failure;
    } else {
      console.log(Chalk.green(`No modified files with filter ${diffFilter} found in ${path}\n`));
    }

    // Extract the date from the filenames for each modified file (e.g. V2022.02.02.2024__my_db_migration_abc.sql)
    const modifiedFilesDate = modifiedFiles.map(file => {
      const date = file.match(/V(\d{4}\.\d{2}\.\d{2}\.\d{4})/);
      return date ? date[1] : null;
    }).filter(date => date !== null);

    console.log(modifiedFilesDate)


    // Detect if any modified files in the feature branch have an older datestamp in the filename (e.g. V2022.02.02.2024__my_db_migration_abc.sql)
    // than the filenames existing in the HEAD branch (e.g. V2022.07.10.1234__existing_older_db_migration.sql), if so, fail the action.
    // const modifiedFilesWithOlderDate = modifiedFiles.filter(file => {
    //   const fileName = file.split('/').pop();
    //   const fileDate = fileName.split('__')[0];
    //   const headFile = `${path}/${file}`;
    //   const headFileDate = (
    //     git.log({ file: headFile })).split('\n')[0].split(' ')[0]; //await?
    //   return fileDate < headFileDate;
    // }).length;
    // if (modifiedFilesWithOlderDate > 0) {
    //   core.setFailed(`${modifiedFilesWithOlderDate} modified files in the feature branch have an older datestamp in the filename than the filenames existing in the HEAD branch.`);
    //   return ExitCode.Failure;
    // }


  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
