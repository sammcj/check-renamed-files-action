# Check Renamed Files

This action checks for renamed files between two git refs.

## Inputs

- `head`: The first ref to check (defaults to main).
- `feature`: The second ref to check (defaults to dev).
- `path`: The path to the file to check (defaults to working directory).
- `similarity`: The similarity threshold to use when comparing files, is treated as a percentage (defaults to 50).
- `diffFilter`: The git diff filter to use when comparing files (R|M|A|C|D|T|U|X|B|*), defaults to R (renamed).

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
        head: main
        feature: dev
        path: src/main/resources/db/migration
        similarity: 50
        diffFilter: R
```
