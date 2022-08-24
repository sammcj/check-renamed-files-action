#!/usr/bin/env node
/* eslint-disable max-params */
/* eslint-disable no-inner-declarations */
import core, { ExitCode } from '@actions/core';
// eslint-disable-next-line import/no-named-as-default
import Chalk from 'chalk';
// eslint-disable-next-line import/no-named-as-default
import simpleGit from 'simple-git';
import process from 'process';
import path from 'path';

let head;
let feature;
let searchPath;
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
  searchPath = core.getInput('path', {
    required: false,
    description: 'Path to compare, defaults to CWD',
    default: '.',
  });
  similarity = core.getInput('similarity', {
    required: false,
    description: 'similarity (50 = 50%)',
    default: '50',
  });
  diffFilter = core.getInput('diffFilter', {
    required: false,
    description: 'Check for modified or renamed files (R|M|A|C|D|T|U|X|B|*), defaults to RAM (renamed, added, modified)',
    default: 'RAM',
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
  diffFilter = 'RAM';
  searchPath = '.';
  process.env.GITHUB_WORKSPACE = process.cwd()
}

// prepend the path with GITHUB_WORKSPACE if it's not absolute
if (!path.isAbsolute(searchPath)) {
  searchPath = `${process.env.GITHUB_WORKSPACE}/${searchPath}`;
}

async function run() {
  try {
    const git = simpleGit(searchPath);

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
      Chalk.bgMagenta.bold(searchPath),
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
          '\npath (searchPath) = ' + searchPath,
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
      head,
      feature,
      '--',
      searchPath,
    ]);

    // Clean up modified files to ensure no false positives with empty lines
    const modifiedFiles = diff.trim().split('\n').filter(file => file !== '');

    // If the diffFilter contains the letter 'R' (renamed) then we need to check specifically for renamed files
    if (diffFilter.includes('R') && modifiedFiles.length > 0) {

      // check if the modified files from the diff were renamed
      const renamedDiff = await git.diff([
        '--name-only',
        '--diff-filter=R',
        `--find-renames=${similarity}%`,
        head,
        feature,
        '--',
        searchPath,
      ]);

      // Clean up modified files to ensure no false positives with empty lines
      const renamedFiles = renamedDiff.trim().split('\n').filter(file => file !== '');
      if (renamedFiles.length > 0) {
        const errorString = `ERROR ${modifiedFiles.length} modified files with filter ${diffFilter} found in ${searchPath} !`
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
        console.log(Chalk.green(`No renamed files found in ${searchPath}\n`));
      }
    }// End of rename block

    // Check for other modified files
    if (modifiedFiles.length > 0) {

      // Check the dates in the file names if enabled
      if (checkFileNameDates) {
        const modifiedFilesDate = modifiedFiles.map(file => {
          const date = file.match(/V(\d{4}\.\d{2}\.\d{2}\.\d{4})/);
          // create a variable that contains all numbers after the $date but before the '__' but don't add the __ to the variable
          const number = file.match(/(\d{4})(?=__)/);
          return {
            file: file,
            date: date ? date[0] : '',
            number: number ? number[0] : '',
          };
        }).filter(file => file.date !== '' && file.number !== '');

        if (modifiedFilesDate.length > 0) {
          // Compare the dates and alert if any are older than files on the head branch (e.g. V2022.02.02.2024 on head vs V2021.01.01.1111 on feature)
          const headFiles = await git.raw(['ls-tree', '-r', '--name-only', head, '--', searchPath]);
          const headFilesDate = headFiles.split('\n').map(file => {
            const date = file.match(/V(\d{4}\.\d{2}\.\d{2}\.\d{4})/);
            const number = file.match(/(\d{4})(?=__)/);
            return {
              file: file,
              date: date ? date[0] : '',
              number: number ? number[0] : '',
            }
          }).filter(date => date !== null);
          if (headFilesDate !== null) {

            // Find the headFilesDate with the newest date and highest number on the head branch
            const newestHeadFile = headFilesDate.reduce((a, b) => {
              if (a.date > b.date) {
                return a;
              }
              if (a.date < b.date) {
                return b;
              }
              if (a.number > b.number) {
                return a;
              }
              if (a.number < b.number) {
                return b;
              }
              return a;
            }).file;
            console.log(Chalk.green(`- Most recent head date: ${newestHeadFile}`));

            // Find the modified files item with the oldest date and lowest number on the feature branch
            const oldestModifiedFile = modifiedFilesDate.reduce((a, b) => {
              if (a.date < b.date) {
                return a;
              }
              if (a.date > b.date) {
                return b;
              }
              if (a.number < b.number) {
                return a;
              }
              if (a.number > b.number) {
                return b;
              }
              return a;
            }).file;
            console.log(Chalk.green(`- Oldest modified date: ${oldestModifiedFile}\n`));

            // Compare the oldest date on the feature branch to the newest date on the head branch
            if (oldestModifiedFile < newestHeadFile) {
              const errorString = `ERROR ${feature} contains modified files that have older dates names than files in ${head}!`
              core.setFailed(errorString);
              ExitCode.Failure;
              console.log(Chalk.red(
                errorString,
                '\n',
                `- Newest file on ${head}:`,
                Chalk.bgRedBright(
                  newestHeadFile, '\n'),
                Chalk.red(
                  `- Oldest modified File on ${feature}:`),
                Chalk.bgRedBright(
                  oldestModifiedFile, '\n')))
              core.setFailed(errorString);
              ExitCode.Failure;
            } else {
              console.log(Chalk.green(`No modified files on ${feature} have names older than files on the ${head}\n`));
            }
          }
        } else {
          console.log(Chalk.green(`No other modified files with filter ${diffFilter} in ${searchPath}\n`));
        }
      }
    } // End of other modified files block

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
