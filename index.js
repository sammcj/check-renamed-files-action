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
  diffFilter = 'R';
  path = process.cwd();
  process.env.GITHUB_WORKSPACE = process.cwd()
}

// if path is an empty string, use the GITHUB_WORKSPACE environment variable
if (path === '') {
  path = process.env.GITHUB_WORKSPACE;
}

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


    if (isGithub) {
      // fetch both refs
      await git.fetch(head);
      await git.fetch(feature);
    }

    if (debug === true) {
      process.env.DEBUG='simple-git:task:*,simple-git:output:*'
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

    const diffClean = diff.split(/\r?\n/) // Split input text into an array of lines
      .filter(line => line.trim() !== '') // Filter out lines that are empty or contain only whitespace
      .join('\n'); // Join line array into a string

    const modifiedFiles = diffClean.split('\n');
    const modifiedFilesArray = modifiedFiles.map((file) => file.split('\n'));

    if (modifiedFiles.length > 1) {
      const errorString = `ERROR ${modifiedFiles.length} modified files with filter ${diffFilter} found in ${path} !`
      console.log(errorString, modifiedFilesArray);
      core.setFailed(errorString);
      ExitCode.Failure;
    } else {
      console.log(Chalk.green(`No modified files with filter ${diffFilter} found in ${path}\n`));
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
