"""
mcp_server.py
-------------
Varinth MCP stdio server.

Exposes two tools:
  - varinth_verify  : run a full audit on an AI-generated answer
  - varinth_compare : compare two AI answers against the same source scope

Exposes one resource:
  - varinth://audits/{audit_run_id} : retrieve a completed audit run

Usage (Claude Desktop / Cursor):
  Configure in mcp_settings.json:
  {
    "varinth": {
      "command": "python",
      "args": ["-m", "app.mcp_server"],
      "cwd": "/path/to/varinth/backend",
      "env": {
        "SUPABASE_URL": "...",
        "SUPABASE_SERVICE_ROLE_KEY": "...",
        "NVIDIA_API_KEY": "..."
      }
    }
  }
"""
import asyncio
import json
import os
import sys

# Ensure parent directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolResult,
    GetPromptResult,
    ListResourcesResult,
    ListToolsResult,
    ReadResourceResult,
    Resource,
    TextContent,
    Tool,
)

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.core.security import SecurityViolationError, assert_path_in_scope
from app.core.database import get_supabase
from app.services.orchestrator import VerificationOrchestrator

configure_logging()
logger = get_logger("varinth.mcp_server")

settings = get_settings()

# ---------------------------------------------------------------------------
# MCP Server setup
# ---------------------------------------------------------------------------
server = Server("varinth")

# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

VERIFY_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "question": {
            "type": "string",
            "description": "The question that was asked to the AI. Max 2000 characters.",
            "maxLength": 2000,
        },
        "answer": {
            "type": "string",
            "description": "The AI-generated answer to audit. Max 10000 characters.",
            "maxLength": 10000,
        },
        "root_path": {
            "type": "string",
            "description": (
                "Absolute path to the source-of-truth directory to search. "
                "Must be a directory you own. The engine will not access "
                "any path outside this directory."
            ),
        },
        "scope_relative_path": {
            "type": "string",
            "description": (
                "Optional relative path within root_path to narrow the search. "
                "Example: 'backend/app/services'. Leave empty to search the entire root."
            ),
            "default": "",
        },
        "max_claims": {
            "type": "integer",
            "description": "Maximum number of claims to extract. Min 1, max 30. Default 15.",
            "minimum": 1,
            "maximum": 30,
            "default": 15,
        },
        "answer_id": {
            "type": "string",
            "description": "Optional identifier for the AI answer being audited (e.g. conversation ID).",
        },
    },
    "required": ["question", "answer", "root_path"],
}

COMPARE_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "question": {
            "type": "string",
            "description": "The question that was asked to both AI systems.",
            "maxLength": 2000,
        },
        "answer_a": {
            "type": "string",
            "description": "First AI-generated answer to compare.",
            "maxLength": 10000,
        },
        "answer_b": {
            "type": "string",
            "description": "Second AI-generated answer to compare.",
            "maxLength": 10000,
        },
        "root_path": {
            "type": "string",
            "description": "Absolute path to the source-of-truth directory.",
        },
        "scope_relative_path": {
            "type": "string",
            "default": "",
        },
    },
    "required": ["question", "answer_a", "answer_b", "root_path"],
}


@server.list_tools()
async def handle_list_tools() -> ListToolsResult:
    return ListToolsResult(tools=[
        Tool(
            name="varinth_verify",
            description=(
                "Audit an AI-generated answer against a bounded source-of-truth directory.\n\n"
                "Extracts atomic claims from the answer, searches the source directory for "
                "relevant evidence using semantic similarity, and assigns each claim a verdict: "
                "supported, contradicted, or unverified — with exact file locations and "
                "evidence snippets.\n\n"
                "Use this to verify any AI answer about code, architecture, config, or "
                "implementation before trusting it."
            ),
            inputSchema=VERIFY_TOOL_SCHEMA,
        ),
        Tool(
            name="varinth_compare",
            description=(
                "Compare two AI-generated answers to the same question against a source-of-truth "
                "directory.\n\n"
                "Runs independent verification on both answers and returns a side-by-side "
                "comparison of their global trust scores and claim verdicts. "
                "Useful for evaluating which AI response is more grounded in the actual codebase."
            ),
            inputSchema=COMPARE_TOOL_SCHEMA,
        ),
    ])


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> CallToolResult:
    if name == "varinth_verify":
        return await _handle_verify(arguments)
    if name == "varinth_compare":
        return await _handle_compare(arguments)
    return CallToolResult(
        content=[TextContent(type="text", text=f"Unknown tool: {name}")],
        isError=True,
    )


async def _handle_verify(args: dict) -> CallToolResult:
    """Handle varinth_verify tool call."""
    try:
        # Validate required arguments
        question = str(args.get("question", "")).strip()
        answer = str(args.get("answer", "")).strip()
        root_path = str(args.get("root_path", "")).strip()
        scope_relative_path = str(args.get("scope_relative_path", "")).strip()
        max_claims = int(args.get("max_claims", 15))
        answer_id = args.get("answer_id")

        if not question:
            return _error_result("'question' is required and cannot be empty.")
        if not answer:
            return _error_result("'answer' is required and cannot be empty.")
        if not root_path:
            return _error_result("'root_path' is required and cannot be empty.")
        if not os.path.isdir(root_path):
            return _error_result(f"root_path '{root_path}' is not a valid directory.")

        max_claims = max(1, min(max_claims, 30))

        # Validate scope path before use
        if scope_relative_path:
            full_scope = os.path.join(root_path, scope_relative_path)
            try:
                assert_path_in_scope(root_path, full_scope)
            except SecurityViolationError as exc:
                return _error_result(f"Scope path violation: {str(exc)}")
            if not os.path.isdir(full_scope):
                return _error_result(
                    f"scope_relative_path '{scope_relative_path}' does not exist "
                    f"within root_path '{root_path}'."
                )

        # Resolve active user_id from env or query database profiles
        user_id = os.getenv("VARINTH_DEFAULT_USER_ID")
        if not user_id:
            try:
                db = get_supabase()
                profile_res = db.table("profiles").select("id").limit(1).execute()
                if profile_res.data:
                    user_id = profile_res.data[0]["id"]
            except Exception as exc:
                logger.warning("mcp_failed_to_resolve_user_id", error=str(exc))

        logger.info(
            "mcp_verify_request",
            root_path=root_path,
            max_claims=max_claims,
            user_id=user_id,
        )

        orchestrator = VerificationOrchestrator()
        result = await orchestrator.run(
            user_id=user_id,
            question=question,
            answer=answer,
            root_path=root_path,
            scope_relative_path=scope_relative_path,
            max_claims=max_claims,
            answer_id=answer_id,
            client_name="mcp",
            transport_type="stdio",
        )

        return CallToolResult(
            content=[TextContent(
                type="text",
                text=_format_verify_result(result),
            )],
            isError=result["status"] == "failed",
        )

    except Exception as exc:
        logger.error("mcp_verify_error", error=str(exc))
        return _error_result(f"Internal error: {type(exc).__name__}: {str(exc)[:200]}")


async def _handle_compare(args: dict) -> CallToolResult:
    """Handle varinth_compare tool call — run verify on both answers and compare."""
    try:
        question = str(args.get("question", "")).strip()
        answer_a = str(args.get("answer_a", "")).strip()
        answer_b = str(args.get("answer_b", "")).strip()
        root_path = str(args.get("root_path", "")).strip()
        scope_relative_path = str(args.get("scope_relative_path", "")).strip()

        if not question or not answer_a or not answer_b or not root_path:
            return _error_result("All of question, answer_a, answer_b, root_path are required.")

        if not os.path.isdir(root_path):
            return _error_result(f"root_path '{root_path}' is not a valid directory.")

        # Resolve active user_id from env or query database profiles
        user_id = os.getenv("VARINTH_DEFAULT_USER_ID")
        if not user_id:
            try:
                db = get_supabase()
                profile_res = db.table("profiles").select("id").limit(1).execute()
                if profile_res.data:
                    user_id = profile_res.data[0]["id"]
            except Exception as exc:
                logger.warning("mcp_failed_to_resolve_user_id", error=str(exc))

        logger.info("mcp_compare_request", root_path=root_path, user_id=user_id)

        orchestrator = VerificationOrchestrator()

        result_a, result_b = await asyncio.gather(
            orchestrator.run(
                user_id=user_id,
                question=question,
                answer=answer_a,
                root_path=root_path,
                scope_relative_path=scope_relative_path,
                answer_id="answer_a",
                client_name="mcp",
                transport_type="stdio",
            ),
            orchestrator.run(
                user_id=user_id,
                question=question,
                answer=answer_b,
                root_path=root_path,
                scope_relative_path=scope_relative_path,
                answer_id="answer_b",
                client_name="mcp",
                transport_type="stdio",
            ),
        )

        return CallToolResult(
            content=[TextContent(
                type="text",
                text=_format_compare_result(result_a, result_b),
            )],
        )

    except Exception as exc:
        logger.error("mcp_compare_error", error=str(exc))
        return _error_result(f"Internal error: {str(exc)[:200]}")


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------

@server.list_resources()
async def handle_list_resources() -> ListResourcesResult:
    return ListResourcesResult(resources=[
        Resource(
            uri="varinth://audits",
            name="Audit Run History",
            description="Recent audit runs. Access individual runs via varinth://audits/{audit_run_id}",
            mimeType="application/json",
        )
    ])


@server.read_resource()
async def handle_read_resource(uri: str) -> ReadResourceResult:
    # varinth://audits/{audit_run_id}
    if uri.startswith("varinth://audits/"):
        audit_run_id = uri.split("/")[-1]
        try:
            from app.core.database import get_supabase
            db = get_supabase()
            run = db.table("audit_runs").select("*").eq("audit_run_id", audit_run_id).execute()
            if not run.data:
                return ReadResourceResult(
                    contents=[TextContent(type="text", text="Audit run not found.")]
                )
            return ReadResourceResult(
                contents=[TextContent(
                    type="text",
                    text=json.dumps(run.data[0], indent=2),
                )]
            )
        except Exception as exc:
            return ReadResourceResult(
                contents=[TextContent(type="text", text=f"Error: {str(exc)}")]
            )

    return ReadResourceResult(
        contents=[TextContent(type="text", text=f"Unknown resource URI: {uri}")]
    )


# ---------------------------------------------------------------------------
# Output formatting helpers
# ---------------------------------------------------------------------------

def _format_verify_result(result: dict) -> str:
    lines = [
        "# Varinth Audit Report",
        "",
        f"**Status:** {result['status'].upper()}",
        f"**Global Trust Score:** {_score_display(result.get('global_score'))}",
        f"**Claims Analyzed:** {result['claim_count']}",
        f"**Duration:** {result.get('duration_ms', 0)}ms",
        "",
    ]

    if result.get("warnings"):
        lines.append("## ⚠️ Warnings")
        for w in result["warnings"]:
            lines.append(f"- **[{w['severity'].upper()}]** {w['message']}")
        lines.append("")

    if not result.get("claims"):
        lines.append("*No claims were extracted from this answer.*")
        return "\n".join(lines)

    lines.append("## Claim Verdicts")
    lines.append("")

    verdict_icons = {
        "supported": "✅",
        "contradicted": "❌",
        "unverified": "⚪",
    }

    for claim in result["claims"]:
        icon = verdict_icons.get(claim["verdict"], "⚪")
        lines.append(f"### {icon} Claim {claim['claim_index']} — `{claim['verdict'].upper()}`")
        lines.append(f"**Importance:** {claim['importance']} | **Type:** {claim['claim_type']}")
        lines.append(f"> {claim['raw_text']}")
        lines.append("")

        if claim.get("explanation"):
            lines.append(f"**Explanation:** {claim['explanation']}")
            lines.append("")

        if claim.get("evidence"):
            lines.append("**Evidence:**")
            for ev in claim["evidence"][:3]:
                lines.append(
                    f"- `{ev['source_id']}` @ {ev['location']} "
                    f"(score: {ev.get('relevance_score', 0):.3f})"
                )
                if ev.get("snippet"):
                    snippet_preview = ev["snippet"][:200].replace("\n", " ")
                    lines.append(f"  ```\n  {snippet_preview}\n  ```")
            lines.append("")
        else:
            lines.append("*No evidence found.*")
            lines.append("")

    # Summary counts
    verdicts = [c["verdict"] for c in result["claims"]]
    lines.extend([
        "---",
        "## Summary",
        f"- ✅ Supported: {verdicts.count('supported')}",
        f"- ❌ Contradicted: {verdicts.count('contradicted')}",
        f"- ⚪ Unverified: {verdicts.count('unverified')}",
    ])

    if result.get("audit_run_id"):
        lines.append(f"\n*Audit ID: `{result['audit_run_id']}`*")

    return "\n".join(lines)


def _format_compare_result(result_a: dict, result_b: dict) -> str:
    score_a = result_a.get("global_score")
    score_b = result_b.get("global_score")

    winner = None
    if score_a is not None and score_b is not None:
        if score_a > score_b:
            winner = "Answer A"
        elif score_b > score_a:
            winner = "Answer B"
        else:
            winner = "Tie"

    lines = [
        "# Varinth Comparison Report",
        "",
        "| Metric | Answer A | Answer B |",
        "|---|---|---|",
        f"| Global Trust Score | {_score_display(score_a)} | {_score_display(score_b)} |",
        f"| Claims Analyzed | {result_a['claim_count']} | {result_b['claim_count']} |",
        f"| Status | {result_a['status']} | {result_b['status']} |",
        "",
    ]

    if winner:
        lines.append(f"**Verdict: {winner} is more grounded in the source.**")
        lines.append("")

    lines.append("## Answer A — Claim Breakdown")
    lines.append(_verdict_summary_table(result_a.get("claims", [])))
    lines.append("")
    lines.append("## Answer B — Claim Breakdown")
    lines.append(_verdict_summary_table(result_b.get("claims", [])))

    return "\n".join(lines)


def _verdict_summary_table(claims: list) -> str:
    if not claims:
        return "_No claims extracted._"
    verdicts = [c["verdict"] for c in claims]
    return (
        f"- ✅ Supported: {verdicts.count('supported')} "
        f"| ❌ Contradicted: {verdicts.count('contradicted')} "
        f"| ⚪ Unverified: {verdicts.count('unverified')}"
    )


def _score_display(score: float | None) -> str:
    if score is None:
        return "N/A"
    pct = int(score * 100)
    bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
    return f"{pct}% {bar}"


def _error_result(message: str) -> CallToolResult:
    return CallToolResult(
        content=[TextContent(type="text", text=f"**Varinth Error:** {message}")],
        isError=True,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    logger.info("varinth_mcp_server_starting", transport="stdio")
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
