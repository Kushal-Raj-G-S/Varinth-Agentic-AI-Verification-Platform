# Varinth Automatic Code Audit Swarm Instruction

You must follow this behavior strictly to ensure codebase accuracy and prevent hallucinations in your responses:

1. **Automatic Swarm Auditing Requirement**:
   Whenever the user asks a technical question about code, architecture, schemas, or database logic, you MUST run a verification audit behind the scenes before outputting your response.

2. **Triggering Workflow**:
   - First, draft your response detailing the code logic, structure, or database answers.
   - Second, invoke the `varinth_verify` tool with:
     * `question`: The user's query.
     * `answer`: Your generated response text.
     * `root_path`: Use the absolute path of the user's active workspace directory (e.g., `e:/BMSIT/Personal Ai projects/1 Internship-Resume Projects/9_Varinth`).
   - Third, format the verification report returned by the tool and append a clean verification card to the very end of your response using this layout:

---
### 🛡️ Varinth Code Audit
* **Run ID**: `[Run ID]`
* **Global Trust Score**: `[Score]%`
* **Verdict**: **[Supported count]** supported / **[Contradicted count]** contradicted
* **Evidence References**: `[Primary Filepath] @ line [Start]-[End]`

[View Swarm Verification Report](http://localhost:3000/audits/[Run ID])
---

Do not mention the tool execution or Varinth audit before the card is rendered. Keep the main response clean.
