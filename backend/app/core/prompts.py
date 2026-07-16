"""
prompts.py
----------
Versioned prompt templates for all LLM-assisted steps in Varinth.
Each prompt function returns the (system_prompt, user_prompt) tuple.
Prompts are versioned. Version changes must be documented.
"""
from typing import Any


# ---------------------------------------------------------------------------
# Claim Extraction – v1
# ---------------------------------------------------------------------------

CLAIM_EXTRACTOR_VERSION = "claim_extractor_v1"


def claim_extractor_prompt(
    question: str,
    answer: str,
    max_claims: int = 15,
) -> tuple[str, str]:
    system = (
        "You are a claim extraction engine for an AI answer verification system.\n"
        "Your only task is to extract atomic, auditable claims from the provided answer.\n\n"
        "Rules:\n"
        "- Return ONLY valid JSON matching exactly the schema below. No prose. No markdown fences.\n"
        "- Do not invent claims not present in the answer.\n"
        "- Do not strengthen, weaken, or paraphrase the meaning of a claim.\n"
        "- Split compound statements into smaller independent claims where they are clearly separable.\n"
        "- Ignore rhetorical filler, style, opinions, and non-verifiable statements.\n"
        "- If a statement cannot be meaningfully audited against code/docs/config, omit it.\n"
        f"- Extract at most {max_claims} claims.\n"
        "- Allowed claim_type values: structural, config, guarantee, performance, other.\n"
        "- Allowed importance values: low, medium, high, critical.\n"
        "  - critical: security, auth, data integrity claims\n"
        "  - high: database, persistence, infrastructure claims\n"
        "  - medium: architectural, library, framework claims\n"
        "  - low: style, naming, minor detail claims\n"
        "- Do not output explanations or commentary outside the JSON.\n"
        "- If information is unclear, preserve the original wording conservatively.\n"
        "- Do NOT invent file names, line numbers, or implementation details.\n\n"
        "Output schema:\n"
        "{\n"
        '  "claims": [\n'
        "    {\n"
        '      "claim_index": <integer starting at 1>,\n'
        '      "raw_text": "<exact claim text from the answer>",\n'
        '      "normalized_text": "<canonical form, minor grammar fix only>",\n'
        '      "claim_type": "<structural|config|guarantee|performance|other>",\n'
        '      "importance": "<low|medium|high|critical>"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user = (
        f"Question asked to the AI:\n{question}\n\n"
        f"AI-generated answer to audit:\n{answer}"
    )

    return system, user


# ---------------------------------------------------------------------------
# Explanation Formatter – v1
# ---------------------------------------------------------------------------

EXPLANATION_FORMATTER_VERSION = "explanation_formatter_v1"


def explanation_formatter_prompt(
    claim_text: str,
    verdict: str,
    evidence_items: list[dict[str, Any]],
) -> tuple[str, str]:
    system = (
        "You are a verdict explanation formatter for an AI verification system.\n"
        "Your only task is to write one concise explanation for the provided claim verdict.\n\n"
        "Rules:\n"
        "- Use ONLY the evidence and verdict data provided. Do not invent anything.\n"
        "- Do not invent file names, line ranges, technologies, or reasoning.\n"
        "- Do not change the verdict or imply stronger certainty than the verdict states.\n"
        "- Keep the explanation to 1-2 sentences. Concrete, not fluffy.\n"
        "- Return ONLY valid JSON: {\"explanation\": \"<text>\"}\n"
        "- If verdict is 'unverified' and no evidence exists, say so plainly.\n"
        "- Do not hedge with 'likely', 'probably', 'seems' — be direct about what the evidence shows.\n"
        "- Do NOT output any prose, markdown fences, or extra keys."
    )

    evidence_str = ""
    if evidence_items:
        parts = []
        for ev in evidence_items[:5]:  # cap at 5 evidence items for context
            parts.append(
                f"  - File: {ev.get('source_id', 'unknown')}, "
                f"Location: {ev.get('location', 'unknown')}, "
                f"Snippet: {ev.get('snippet', '')[:200]}"
            )
        evidence_str = "\n".join(parts)
    else:
        evidence_str = "  (none)"

    user = (
        f"Claim: {claim_text}\n"
        f"Verdict: {verdict}\n"
        f"Evidence:\n{evidence_str}"
    )

    return system, user


# ---------------------------------------------------------------------------
# Output Repair – v1
# ---------------------------------------------------------------------------

REPAIR_ASSISTANT_VERSION = "repair_json_v1"


def output_repair_prompt(
    invalid_json: str,
    schema_description: str,
    validation_errors: str,
) -> tuple[str, str]:
    system = (
        "You are a structured output repair assistant.\n"
        "Your only task is to repair invalid JSON so it matches the required schema exactly.\n\n"
        "Rules:\n"
        "- Do NOT add new semantic information.\n"
        "- Do NOT invent values for unknown or missing fields.\n"
        "- Preserve existing meaning.\n"
        "- Remove illegal fields.\n"
        "- Fix invalid field names or types only when the intended mapping is obvious.\n"
        "- Return ONLY valid JSON. No prose. No markdown fences."
    )

    user = (
        f"Schema:\n{schema_description}\n\n"
        f"Validation errors:\n{validation_errors}\n\n"
        f"Invalid output to repair:\n{invalid_json}"
    )

    return system, user
