# Varinth PR Audit (GitHub Action)

Audits a pull request's **title + description** against the actual code at
the PR's head commit, and posts the result as a comment on the PR — updated
in place on every push, not re-posted.

This is the difference between Varinth living in a separate dashboard you
have to remember to visit, and Varinth catching a stale or wrong PR
description the moment it's opened, right where your team already reads it.

## What it checks

If a PR description says things like *"adds rate limiting to the login
endpoint"* or *"switches caching from Redis to in-memory"*, Varinth extracts
those as claims, searches the repo at the PR's actual head commit for
supporting or contradicting evidence, and reports a verdict with file/line
citations for each one — the same engine behind `varinth_verify` and the web
dashboard, pointed at a PR instead of a chat answer.

## Setup

1. **Run a Varinth backend** you control (see the root [`docker-compose.yml`](../../docker-compose.yml)), and sign in to the frontend.
2. **Create an API key**: Varinth dashboard → *Settings → API Keys* → *New key*. Copy it immediately — it's shown once.
3. In the **target repo**'s `Settings → Secrets and variables → Actions → New repository secret`, add:
   | Name | Value |
   |---|---|
   | `VARINTH_API_URL` | Your backend's base URL, e.g. `https://varinth.example.com` |
   | `VARINTH_API_KEY` | The key from step 2 |
4. Copy [`.github/workflows/varinth-pr-audit.yml`](../../.github/workflows/varinth-pr-audit.yml) from this repo into the target repo's `.github/workflows/`. You don't need to copy `varinth_pr_audit.py` — the workflow fetches it fresh from this repo on every run.
5. Open (or push to) a PR. Varinth comments within a minute or two.

Until both secrets are set, the workflow no-ops with a notice instead of
failing — safe to merge the workflow file ahead of generating a key.

## Optional: block merges on contradicted claims

By default the audit is informational only — it never fails the PR's
checks. To make a contradicted claim block merging (via branch protection
on this check), set a repository **variable** (not secret) named
`VARINTH_FAIL_ON_CONTRADICTION` to `true`.

## How it audits the right commit, not `main`

The script registers the repo as a Varinth *source context* (idempotent —
safe to run on every PR) and passes the PR's head SHA as the audit's `ref`,
so Varinth checks the claim against the code as it will exist *after* the
PR merges, not against the base branch.

## Limits

- Private repos: `VARINTH_API_URL` must be reachable from GitHub's hosted
  runners, and the backend's own git checkout (`_sync_checkout_git_repo` in
  `orchestrator.py`) needs credentials for the repo if it's private — use an
  HTTPS URL with an embedded deploy token, or self-host runners with SSH
  access configured on the Varinth backend's host.
- One PR audit at a time per repo: concurrent runs against the same repo
  URL serialize on Varinth's own checkout lock (see `orchestrator.py`), so a
  burst of pushes queues rather than races.
