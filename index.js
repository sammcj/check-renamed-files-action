#!/usr/bin/env node
import process from 'process';
import path from 'path';
/* eslint-disable max-params */
/* eslint-disable no-inner-declarations */
import core, { ExitCode } from '@actions/core';
// eslint-disable-next-line import/no-named-as-default
import Chalk from 'chalk';
// eslint-disable-next-line import/no-named-as-default
import simpleGit from 'simple-git';

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
    description:
      'Check for modified or renamed files (R|M|A|C|D|T|U|X|B|*), defaults to RAM (renamed, added, modified)',
    default: 'RAM',
  });
  checkFileNameDates = core.getBooleanInput('checkFileNameDates', {
    required: false,
    description:
      'Enables checking of dates in file names with the format VYYYY.MM.DD.NNNN, e.g. V2022.02.02.2024',
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
  process.env.GITHUB_WORKSPACE = process.cwd();
}

// prepend the path with GITHUB_WORKSPACE if it's not absolute
if (!path.isAbsolute(searchPath)) {
  searchPath = `${process.env.GITHUB_WORKSPACE}/${searchPath}`;
}

async function run() {
  try {
    const git = simpleGit(searchPath);

    // Get the name of the current branch
    const currentBranch = (await git.raw('rev-parse', '--abbrev-ref', 'HEAD')).trimEnd();

    if (currentBranch === head) {
      core.setFailed(
        `Current branch is ${JSON.stringify(
          currentBranch,
        )}, you must run this on the branch you wish to check, e.g. ${feature}`,
      );
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

    // If we are running on actions, fetch and checkout both refs
    if (isGithub) {
      await git.fetch(head);
      await git.fetch(feature);
      await git.checkout(head);
      await git.checkout(feature);
    }

    // If debug is enabled, print useful variables
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
          '\ngit log:\n',
        ),
        await git.log(),
        '\ngit status:\n',
        await git.status(),
        Chalk.red('\n#### END DEBUG ####\n'),
      );
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
    const modifiedFiles = diff
      .trim()
      .split('\n')
      .filter((file) => file !== '');

    // Check for other modified files
    if (modifiedFiles.length > 0) {
      // If the diffFilter contains the letter 'R' (renamed) AND there are modified files
      // we need to do a renamed files check
      if (diffFilter.includes('R')) {
        console.log('\n--- Checking for renamed files ---\n');

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

        // Clean up renamed files diff to split on new lines, and remove empty lines
        const renamedFiles = renamedDiff
          .trim()
          .split('\n')
          .filter((file) => file !== '');

        // If a file has been renamed throw an error
        if (renamedFiles.length > 0) {
          const errorString = `ERROR ${renamedFiles.length} renamed files found!`;
          core.setFailed(errorString);
          ExitCode.Failure;
          console.log(Chalk.red(errorString));
          renamedFiles.forEach((file) => {
            console.log(Chalk.bgRedBright(file));
          });
        } else {
          console.log(Chalk.green('No renamed files found\n---'));
        }
      } // End of rename block

      // Check the dates in the file names if enabled
      if (checkFileNameDates) {
        console.log('\n--- Checking dates in file names ---\n');
        const modifiedFilesDate = modifiedFiles
          .map((file) => {
            const date = file.match(/V(\d{4}\.\d{2}\.\d{2})/);
            // create a variable that contains all numbers after the $date but before the '__' but don't add the __ to the variable
            const number = file.match(/(\d{4})(?=__)/);
            return {
              file: file, // test/V2022.01.02.2024__my_db_migration.sql
              date: date ? date[1] : '', // 2022.01.02
              number: number ? number[0] : '', // 1234
            };
          })
          .filter((file) => file.date !== '' && file.number !== '');

        debug
          ? modifiedFilesDate.forEach((file) => {
            console.log(
              Chalk.blue(
                `${feature} File: ${file.file} has date: ${file.date} and number: ${file.number}`,
              ),
            );
          })
          : null;

        if (modifiedFilesDate.length > 0) {
          // Compare the dates and alert if any are older than files on the head branch (e.g. V2022.02.02.2024 on head vs V2021.01.01.1111 on feature)
          const headFiles = await git.raw(['ls-tree', '-r', '--name-only', head, '--', searchPath]);
          const headFilesDate = headFiles
            .split('\n')
            .map((file) => {
              const date = file.match(/V(\d{4}\.\d{2}\.\d{2})/);
              const number = file.match(/(\d{4})(?=__)/);
              return {
                file: file, // test/V2022.01.02.2024__my_db_migration.sql
                date: date ? date[1] : '', // 2022.01.02
                number: number ? number[0] : '', // 1234
              };
            })
            .filter((file) => file.date !== '' && file.number !== '');

          debug
            ? headFilesDate.forEach((file) => {
              console.log(
                Chalk.yellow(
                  `[${head}] - File: ${file.file} has date: ${file.date} and number: ${file.number}`,
                ),
              );
            })
            : null;
          // get the oldest combination of `${date}.${number}` for the feature branch
          const oldestFeatureFile = modifiedFilesDate.reduce((oldest, current) => {
            const currentFile = `${current.date}.${current.number}`;
            const oldestFile = `${oldest.date}.${oldest.number}`;
            return currentFile < oldestFile ? current : oldest;
          });
          // get the newest combination of `${date}.${number}` for the head branch
          const newestHeadFile = headFilesDate.reduce((newest, current) => {
            const currentFile = `${current.date}.${current.number}`;
            const newestFile = `${newest.date}.${newest.number}`;
            return currentFile > newestFile ? current : newest;
          });

          if (headFilesDate !== null) {
            // compare the oldest feature file to the newest head file
            const oldestFeatureFileString = `${oldestFeatureFile.date}.${oldestFeatureFile.number}`;
            const newestHeadFileString = `${newestHeadFile.date}.${newestHeadFile.number}`;
            if (oldestFeatureFileString < newestHeadFileString) {
              const errorString = `ERROR Files on [${feature}] found to be older than [${head}]!`;
              core.setFailed(errorString);
              ExitCode.Failure;
              console.log(
                Chalk.red(
                  `- Newest file on [${Chalk.yellow(head)}]:`,
                  Chalk.bgRedBright(newestHeadFileString),
                  Chalk.red(`is newer than the oldest modified file on [${Chalk.blue(feature)}]:`),
                  Chalk.bgRedBright(oldestFeatureFileString, '\n'),
                ),
              );
            } else {
              console.log(
                Chalk.green(
                  `No modified files on [${feature}] have names older than files on the [${head}]\n`,
                ),
              );
            }
          }
        } else {
          console.log(
            Chalk.green(`No other modified files with filter ${diffFilter} in ${searchPath}\n`),
          );
        }
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
