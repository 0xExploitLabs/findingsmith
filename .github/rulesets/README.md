# Rulesets for `main`

These files describe how `main` is protected.
GitHub does not read them from the repository: they are applied once, through the API or the settings page, and kept here so a change to them is reviewed like any other.

## What they enforce

`main.json` applies to everyone, maintainers included:

- Every change arrives through a pull request, merged by rebase.
- The CI checks "Lint, types, unit tests, build" and "Browser tests" pass on a branch that is up to date with `main`.
- `main` cannot be force-pushed or deleted, and its history stays linear.

`main-review.json` adds one rule: a pull request needs an approval, the approval comes after its last push, and every review thread is resolved.
Repository admins may bypass this ruleset, and only through a pull request.
Rules from both rulesets add up, and a bypass covers only its own ruleset, so a maintainer's own pull request still needs a green CI but no second person.

Both required checks must come from GitHub Actions (app id 15368), so another app cannot pass them by reporting a check of the same name.
The Cloudflare build is not required: it deploys a preview rather than testing, and Cloudflare's documentation does not say it runs for pull requests from forks.

## Applying them

GitHub offers rulesets on private repositories only on a paid plan, so these apply once the repository is public or the organisation upgrades.

```sh
gh api repos/0xExploitLabs/findingsmith/rulesets --method POST --input .github/rulesets/main.json
gh api repos/0xExploitLabs/findingsmith/rulesets --method POST --input .github/rulesets/main-review.json
```

Then open **Settings**, **Rules**, **Rulesets**, **main-review** and check that the bypass list shows **Repository admin**: the file names the role by its id, 5.

To change one later, edit its file, then send it to the existing ruleset:

```sh
gh api repos/0xExploitLabs/findingsmith/rulesets --jq '.[] | "\(.id) \(.name)"'
gh api repos/0xExploitLabs/findingsmith/rulesets/<id> --method PUT --input .github/rulesets/main.json
```

In the browser, the same files can be loaded under **Settings**, **Rules**, **Rulesets**, **New ruleset**, **Import a ruleset**.
