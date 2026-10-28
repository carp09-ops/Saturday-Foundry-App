# Retired patch workflows

These one-off workflows belong to earlier versions of Saturday Foundry. They are
preserved here for history and are intentionally outside `.github/workflows`, so
GitHub Actions cannot run them. Do not move them back to the active folder.

Some extract old ZIP releases, delete `assets`, or rewrite HTML and push commits.
Running them against version 10 would overwrite the native site and artwork.
The active `release-checks.yml` workflow only validates committed build outputs
and runs regression tests. It does not deploy or modify the repository or database.
