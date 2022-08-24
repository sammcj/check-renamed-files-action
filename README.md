# Check Renamed Files

This action checks for renamed files between two git refs.

## Inputs

- `head`: The first ref to check (defaults to origin/main).
- `feature`: The second ref to check, usually the branch you're running this from (defaults to ${{ github.ref_name }}).
- `path`: The path to the file to check (defaults to working directory).
- `similarity`: The similarity threshold to use when comparing files, is treated as a percentage (defaults to 50).
- `diffFilter`: The git diff filter to use when comparing files (R|M|A|C|D|T|U|X|B|*), defaults to R (renamed).
- `checkFileNameDates`: Enables checking of dates in file names with the format VYYYY.MM.DD.NNNN (e.g. V2022.02.02.2024)
- `debug`: Whether to output debug information (true|false).

## Outputs

- `modifiedFiles`: An array of files that were renamed between the two refs.

## Usage

```yaml
name: Check for renamed files

on:
  merge:
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
        feature: ${{ github.ref_name }}
        path: src/main/resources/db/migration
        similarity: 50
        diffFilter: R
        checkFileNameDates: false
        debug: false
```

## Filters

This Action uses standard git diff filters.

Any combination of the filter characters (including none) can be used.

When `*` (All-or-none) is added to the combination, all paths are selected if there is any file that matches other criteria in the comparison; if there is no file that matches other criteria, nothing is selected.

- `A` - Select only files that are Added
- `C` - Copied
- `D` - Deleted
- `M` - Modified
- `R` - Renamed
- `T` - Type change (i.e. regular file, symlink, submodule, …​)
- `U` - Unmerged
- `X` - Unknown
- `B` - Broken symbolic link (pairing broken)
