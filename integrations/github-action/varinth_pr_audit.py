#!/usr/bin/env python3
"""
varinth_pr_audit.py
--------------------
Runs inside a GitHub Actions `pull_request` job. Audits a PR's title +
description against the actual code at the PR's head commit using the
Varinth API, then posts (or updates) a single PR comment with the result.

Stdlib-only by design — no pip install step needed in the workflow.

Required environment (set by GitHub Actions / the workflow):
  GITHUB_EVENT_PATH   - path to the pull_request event JSON payload
  GITHUB_REPOSITORY   - "owner/repo"
  GITHUB_TOKEN        - used only to read/post the PR comment via the
                        GitHub REST API (needs `pull-requests: write`)

Required secrets (set by the user in their repo settings):
  VARINTH_API_URL     - base URL of a running Varinth backend
  VARINTH_API_KEY      - a Varinth API key (see /settings/api-keys), used
                        to authenticate the audit request

Optional:
  VARINTH_MAX_CLAIMS           - default 10
  VARINTH_FAIL_ON_CONTRADICTION - "true" to fail the job (non-zero exit)
                                   if any claim comes back contradicted.
                                   Default "false" — informational only.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

COMMENT_MARKER = "<!-- varinth-pr-audit -->"
VERDICT_EMOJI = {
    "supported": "✅",
    "contradicted": "❌",
    "unverified": "❔",
}


def _env(name: str, default: str | None = None, required: bool = False) -> str | None:
    value = os.environ.get(name, default)
    if required and not value:
        print(f"::error::Missing required environment variable: {name}")
        sys.exit(1)
    return value


def _http_json(url: str, method: str = "GET", headers: dict | None = None, body: dict | None = None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, {"detail": raw.decode("utf-8", errors="replace")}


def _repo_slug(owner: str, repo: str) -> str:
    """Derive a context slug matching Varinth's ^[a-z0-9_-]{1,64}$ pattern."""
    raw = f"{owner}-{repo}".lower()
    slug = re.sub(r"[^a-z0-9_-]", "-", raw)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug[:64] or "repo"


def ensure_context(api_url: str, api_key: str, slug: str, name: str, clone_url: str) -> None:
    status, payload = _http_json(
        f"{api_url}/api/v1/contexts",
        method="POST",
        headers={"Authorization": f"Bearer {api_key}"},
        body={"name": name, "slug": slug, "root_path": clone_url},
    )
    if status == 201 or status == 409:
        return  # created, or already exists — either is fine
    print(f"::warning::Failed to register Varinth context (status {status}): {payload}")


def run_audit(api_url: str, api_key: str, slug: str, ref: str, question: str, answer: str, max_claims: int):
    status, payload = _http_json(
        f"{api_url}/api/v1/audits",
        method="POST",
        headers={"Authorization": f"Bearer {api_key}"},
        body={
            "question": question,
            "answer": answer,
            "context_slug": slug,
            "ref": ref,
            "max_claims": max_claims,
        },
    )
    if status not in (200, 201):
        print(f"::error::Varinth audit request failed (status {status}): {payload}")
        sys.exit(1)
    return payload


def format_comment(result: dict, pr_head_sha: str) -> str:
    score = result.get("global_score")
    score_pct = f"{score * 100:.0f}%" if isinstance(score, (int, float)) else "n/a"
    claims = result.get("claims", [])

    lines = [
        COMMENT_MARKER,
        "## 🔍 Varinth PR Audit",
        "",
        f"**Trust score: {score_pct}** — checked against commit `{pr_head_sha[:7]}`",
        "",
    ]

    if not claims:
        lines.append("_No verifiable claims were found in the PR description._")
    else:
        lines.append("| | Claim | Confidence | Evidence |")
        lines.append("|---|---|---|---|")
        for c in claims:
            verdict = c.get("verdict", "unverified")
            emoji = VERDICT_EMOJI.get(verdict, "❔")
            claim_text = (c.get("raw_text") or c.get("normalized_text") or "").replace("|", "\\|")
            if len(claim_text) > 140:
                claim_text = claim_text[:140] + "…"
            confidence = c.get("confidence")
            confidence_str = f"{confidence:.2f}" if isinstance(confidence, (int, float)) else "—"
            evidence = c.get("evidence") or []
            if evidence:
                top = evidence[0]
                evidence_str = f"`{top.get('source_id', '?')}` {top.get('location', '')}"
            else:
                evidence_str = "—"
            lines.append(f"| {emoji} | {claim_text} | {confidence_str} | {evidence_str} |")

    warnings = result.get("warnings", [])
    if warnings:
        lines.append("")
        lines.append("<details><summary>Warnings</summary>")
        lines.append("")
        for w in warnings:
            lines.append(f"- `{w.get('warning_code') or w.get('code')}`: {w.get('message')}")
        lines.append("")
        lines.append("</details>")

    lines.append("")
    lines.append("<sub>Posted by [Varinth](https://github.com/Kushal-Raj-G-S/Varinth-Agentic-AI-Verification-Platform) — verifies AI/PR claims against your actual codebase.</sub>")
    return "\n".join(lines)


def upsert_pr_comment(repo: str, pr_number: int, token: str, body: str) -> None:
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
    }
    status, comments = _http_json(
        f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments?per_page=100",
        headers=headers,
    )
    existing_id = None
    if status == 200 and isinstance(comments, list):
        for c in comments:
            if COMMENT_MARKER in (c.get("body") or ""):
                existing_id = c.get("id")
                break

    if existing_id:
        status, _ = _http_json(
            f"https://api.github.com/repos/{repo}/issues/comments/{existing_id}",
            method="PATCH",
            headers=headers,
            body={"body": body},
        )
    else:
        status, _ = _http_json(
            f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments",
            method="POST",
            headers=headers,
            body={"body": body},
        )

    if status not in (200, 201):
        print(f"::warning::Failed to post PR comment (status {status}).")


def main() -> None:
    api_url = _env("VARINTH_API_URL", required=True).rstrip("/")
    api_key = _env("VARINTH_API_KEY", required=True)
    github_token = _env("GITHUB_TOKEN", required=True)
    repo_full = _env("GITHUB_REPOSITORY", required=True)
    event_path = _env("GITHUB_EVENT_PATH", required=True)
    max_claims = int(_env("VARINTH_MAX_CLAIMS", "10"))
    fail_on_contradiction = _env("VARINTH_FAIL_ON_CONTRADICTION", "false").lower() == "true"

    with open(event_path, encoding="utf-8") as f:
        event = json.load(f)

    pr = event.get("pull_request")
    if not pr:
        print("::notice::No pull_request payload found in event — nothing to audit.")
        return

    owner, repo_name = repo_full.split("/", 1)
    pr_number = pr["number"]
    title = (pr.get("title") or "").strip()
    body = (pr.get("body") or "").strip()
    head_sha = pr["head"]["sha"]
    clone_url = pr["base"]["repo"]["clone_url"]

    answer = f"{title}\n\n{body}".strip()
    if not answer:
        print("::notice::PR has no title or description to audit — skipping.")
        return

    slug = _repo_slug(owner, repo_name)
    ensure_context(api_url, api_key, slug, f"{owner}/{repo_name}", clone_url)

    question = (
        "Does this pull request's title and description accurately describe "
        "the actual state of the codebase at this commit?"
    )
    result = run_audit(api_url, api_key, slug, head_sha, question, answer, max_claims)

    comment_body = format_comment(result, head_sha)
    upsert_pr_comment(repo_full, pr_number, github_token, comment_body)

    if fail_on_contradiction:
        if any(c.get("verdict") == "contradicted" for c in result.get("claims", [])):
            print("::error::One or more PR description claims were contradicted by the code.")
            sys.exit(1)


if __name__ == "__main__":
    main()
