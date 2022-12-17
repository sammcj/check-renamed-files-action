# Check Renamed Files

[![Build Status (latest push)](https://github.com/sammcj/check-renamed-files-action/workflows/Bump%20version/badge.svg)](https://github.com/sammcj/check-renamed-files-action/workflows/bump-version)
[![Stable Version](https://img.shields.io/github/v/tag/sammcj/check-renamed-files-action)](https://img.shields.io/github/v/tag/sammcj/check-renamed-files-action)
[![Latest Release](https://img.shields.io/github/v/release/sammcj/check-renamed-files-action?color=%233D9970)](https://img.shields.io/github/v/release/sammcj/check-renamed-files-action?color=%233D9970)

This action checks for renamed files between two git refs.

![Screen Shot 2022-09-01 at 2 45 09 pm](https://user-images.githubusercontent.com/862951/187833217-8a0c3309-496e-4704-9a21-dfae79408206.jpg)

## Assumptions

*Lots*! I whipped this up to solve a specific use case in mind for checking if database migrations files on a PR were renamed from or older than on the main branch, but it wouldn't take much to adapt it for more generic cases - mostly some additional parasitisation of filters / regexes for file names.

- For checkFileNameDates to work, the dates in the filenames much be of format VYYYY.MM.DD.NNNN__string, e.g. V2019.01.01.0000__some_string.sql

## Inputs

- `head`: The first ref to check (defaults to origin/main).
- `feature`: The second ref to check, usually the branch you're running this from (defaults to dev, recommended to use ${{ github.head_ref }}).
- `path`: The path to the file to check (defaults to working directory).
- `similarity`: The similarity threshold to use when comparing files, is treated as a percentage (defaults to 50).
- `diffFilter`: The git diff filter to use when comparing files (R|M|A|C|D|T|U|X|B|*), defaults to RAM (renamed, added, modified).
- `checkFileNameDates`: Enables checking of dates in file names with the format VYYYY.MM.DD.NNNN (e.g. V2022.02.02.2024)
- `debug`: Whether to output debug information (true|false).

## Outputs

- `modifiedFiles`: An array of files that were renamed between the two refs.

## Usage

```yaml
name: Check for renamed files
on:
  pull_request:
    branches:
      - main

jobs:
  check-renamed-files:
    - uses: actions/checkout@v3
      with:
        fetch-depth: '0'
    - uses: sammcj/check-renamed-files-action@main
      with:
        head: 'origin/main'
        feature: ${{ github.head_ref }}
        path: src/main/resources/db/migration
        similarity: 50
        diffFilter: RAM
        checkFileNameDates: false
        debug: false
```

## Filters

This Action uses standard git diff filters.

Any combination of the filter characters (including none) can be used.

When `*` (All-or-none) is added to the combination, all paths are selected if there is any file that matches other criteria in the comparison; if there is no file that matches other criteria, nothing is selected.

- `A` - Added
- `C` - Copied
- `D` - Deleted
- `M` - Modified
- `R` - Renamed
- `T` - Type change (i.e. regular file, symlink, submodule, …​)
- `U` - Unmerged
- `X` - Unknown
- `B` - Broken symbolic link (pairing broken)
