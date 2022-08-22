# Check Renamed Files

This action checks for renamed files between two git refs.

## Inputs

- `head`: The first ref to check.
- `feature`: The second ref to check.
- `path`: The path to the file to check.
- `similarity`: The similarity threshold to use when comparing files, is treated as a percentage (e.g. 50 = 50%).

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
```
