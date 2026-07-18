# Varinth & Antigravity IDE Integration Guide

This guide documents the exact architecture and setup required to integrate **Varinth** as a global trust and verification layer inside **Antigravity IDE** using the Model Context Protocol (MCP).

---

## 1. The Creator-Verifier Architecture

Instead of competing with the IDE's coding assistant, Varinth operates as an independent **verification pass** at the end of the generation cycle:

* **Antigravity (Creator)**: Generates technical explanations, code structures, or refactoring diffs.
* **Varinth (Verifier)**: Runs a three-agent Critic-Verifier-Judge swarm behind the scenes to audit the assistant's output against the local codebase context.
* **Varinth Dashboard (Deep Audit View)**: Renders a premium, dynamic web UI showing the detailed evidence accordions, confidence metrics, and syntax-highlighted code ranges.

---

## 2. Configuration: Registering the MCP Server

The IDE requires the Varinth stdio server to be registered in its global configuration file.

### File Location:
`C:\Users\kushalrajgs\.gemini\antigravity-ide\mcp_config.json`

### Content Schema:
```json
{
  "mcpServers": {
    "varinth": {
      "command": "e:/BMSIT/Personal Ai projects/1 Internship-Resume Projects/9_Varinth/backend/venv/Scripts/python.exe",
      "args": ["-m", "app.mcp_server"],
      "cwd": "e:/BMSIT/Personal Ai projects/1 Internship-Resume Projects/9_Varinth/backend",
      "env": {
        "SUPABASE_URL": "https://nkonhxpkcprvtlbvbrjo.supabase.co",
        "SUPABASE_ANON_KEY": "your_supabase_anon_key",
        "SUPABASE_SERVICE_ROLE_KEY": "your_supabase_service_role_key",
        "NVIDIA_API_KEY": "your_nvidia_api_key",
        "NVIDIA_API_BASE_URL": "https://integrate.api.nvidia.com/v1",
        "NVIDIA_EMBED_MODEL": "nvidia/nv-embedqa-e5-v5",
        "NVIDIA_CHAT_MODEL": "meta/llama-3.1-8b-instruct",
        "ALLOWED_ORIGINS": "http://localhost:3000",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

> [!IMPORTANT]
> Always use the absolute path to the virtual environment's Python executable (`venv/Scripts/python.exe`) as the `command`. This guarantees that dependencies like `mcp` and `supabase` resolve without import errors.

---

## 3. Automation: Enabling Global Auto-Verification

To enforce Varinth verification sweeps automatically on all technical queries without modifying repository files, the rule is registered as a **Global Customization Skill**.

### File Location:
`C:\Users\kushalrajgs\.gemini\config\skills\varinth_verify_rule\SKILL.md`

### Content Schema:
```markdown
---
name: Varinth Automatic Code Audit Swarm
description: Triggers on any codebase query, coding explanation, code block, file path, repository, implementation question, python, javascript, react, or software architecture question.
---

# Varinth Verification System Rule

Whenever the user asks a technical question about the codebase, you MUST automatically run a verification audit behind the scenes to prove the validity of your claims.

## Required Workflow
1. **Generate Draft Answer**: Formulate your response explaining the code logic, structure, or implementation details.
2. **Execute Varinth Tool**: Before returning your message, invoke the `varinth_verify` tool:
   - `question`: The user's query.
   - `answer`: Your generated response text.
   - `root_path`: The path of the audited codebase.
3. **Append the Audit Card**: Format the tool's JSON findings and append a clean verification card to the very end of your response using this layout:

---
### 🛡️ Varinth Code Audit
* **Run ID**: `[Run ID]`
* **Global Trust Score**: `[Score]%`
* **Verdict**: **[Supported count]** supported / **[Contradicted count]** contradicted
* **Evidence References**: `[Primary Filepath] @ line [Start]-[End]`

[View Swarm Verification Report](http://localhost:3000/audits/[Run ID])
---
```

---

## 4. Under-the-Hood Local Resolvers

To make local MCP sweeps compatible with Varinth's SaaS codebase architecture, two key engine updates were made:

### A. Local Filesystem Support (Bypassing Git Clones)
The orchestrator originally required remote Git URLs to clone codebases. We modified the `root_path` validation check in [orchestrator.py](file:///e:/BMSIT/Personal%20Ai%20projects/1%20Internship-Resume%20Projects/9_Varinth/backend/app/services/orchestrator.py):
* When running via local `stdio` (MCP), it skips remote git cloning and directly reads files from the user's local directory path.

### B. Dynamic User Profile Resolution
Because MCP executions do not carry browser auth tokens, runs were originally saved under `user_id = NULL`, triggering 404 errors on the dashboard due to Row-Level Security (RLS) policies.
* We modified [mcp_server.py](file:///e:/BMSIT/Personal%20Ai%20projects/1%20Internship-Resume%20Projects/9_Varinth/backend/app/mcp_server.py) to look up `VARINTH_DEFAULT_USER_ID` or query the local `profiles` table to resolve the active developer account ID. This binds all MCP audits directly to your dashboard user profile.
