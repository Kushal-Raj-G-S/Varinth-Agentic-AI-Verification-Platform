Varinth – Prompting Rules, Model Behaviors & LLM Constraints
1. Purpose of this document
This document defines how LLM-assisted components inside Varinth are allowed to behave.

It exists to prevent:

vague prompting,

drifting output structures,

hallucinated fields,

hidden reasoning leakage,

inconsistent claim extraction,

and explanation text that sounds smart without being grounded.

The document covers:

prompt design principles,

allowed model roles,

output rules,

fallback behavior,

schema discipline,

non-invention constraints,

validation expectations,

and example prompt contracts.

This is not a generic prompt engineering note.
It is a behavior contract for LLM-assisted parts of Varinth.

2. Why this document exists
Varinth is a verification product. That means LLM usage must be tightly constrained.

If prompts are loose, the model will start doing what LLMs always do when given space:

invent missing structure,

smooth over uncertainty,

merge multiple claims into one,

upgrade weak evidence into confident prose,

and produce aesthetically clean nonsense.

That is unacceptable in a verification system.

Structured outputs, explicit schemas, and validation layers are widely used to improve reliability because free-form outputs are harder to parse, harder to audit, and easier to let slip into silent failure states.

So the rule is simple:

In Varinth, the model does not get to improvise core system behavior.

3. Core prompting principles
3.1 Schema first, prose second
Whenever an LLM returns machine-consumable output, it must be asked to return a strict schema-shaped result.

The schema should be treated as the real contract.
The natural-language prompt only explains behavior around that contract.

Rule
If the result is parsed by code, it must be schema-constrained.

If a field is not defined in the schema, the model must not invent it.

additionalProperties behavior should be treated as disallowed by default.

3.2 Never invent missing facts
This is one of the most important rules in the entire system.

Rule
If the required information is not present in the input or supported retrieval context, the model must:

return null,

omit the optional field,

or use an allowed uncertainty value,

depending on the schema contract.

It must never:

guess,

infer hidden implementation details,

fabricate file names,

fabricate line ranges,

fabricate technologies,

or manufacture confidence.

This rule is non-negotiable.

3.3 Role separation must stay strict
Each model-assisted step should have a narrow role.

Bad system design:

one mega-prompt that extracts claims, retrieves evidence, judges truth, explains results, and assigns severity.

Good system design:

one role for claim extraction,

one role for explanation formatting,

one role for optional repair,

deterministic layers for verdict assignment wherever possible.

The more roles are mixed, the harder it becomes to trust or debug behavior.

3.4 Determinism matters more than eloquence
For verification workflows, consistent behavior is more valuable than pretty wording.

Rule
Prefer prompts that generate:

stable structures,

repeatable extraction patterns,

conservative wording,

and minimal stylistic variance.

Do not optimize for creative fluency.

3.5 Reasoning must not leak into unsupported verdicts
The model may help interpret text, but it must not pretend that internal reasoning is evidence.

Rule
A verdict or explanation may refer only to:

extracted claim text,

retrieved evidence,

configured metadata,

deterministic rule outputs.

The model must not justify a result using hidden intuition like:

“this is likely because most systems do X,”

“this pattern usually implies Y,”

or “the architecture appears to suggest Z.”

That is garbage in this context.

4. Allowed LLM roles in Varinth
Only a small set of model-assisted roles are allowed in v1.

4.1 Claim extractor
Purpose
Convert an answer into atomic auditable claims.

Allowed behavior
split composite answers into discrete claims,

normalize phrasing,

ignore non-verifiable fluff,

preserve semantic meaning.

Forbidden behavior
assign truth status,

invent evidence,

combine unrelated claims,

rewrite claims into stronger language than the input.

4.2 Explanation formatter
Purpose
Turn structured verdict metadata into short readable explanations.

Allowed behavior
summarize verdict rationale using existing structured inputs,

refer to evidence snippets already selected,

produce concise user-facing language.

Forbidden behavior
introduce new evidence,

override verdicts,

invent certainty,

re-interpret unsupported claims as supported.

4.3 Output repair assistant
Purpose
Repair malformed structured outputs when validation fails.

Allowed behavior
fix field names,

remove illegal properties,

coerce allowed types if rules permit,

regenerate a valid schema-shaped output.

Forbidden behavior
add missing information not present in input,

“repair” by inventing values,

silently change claim semantics.

4.4 Optional summarizer
Purpose
Generate compact run summaries for UI or logs.

Allowed behavior
summarize already computed structured outcomes.

Forbidden behavior
change verdict logic,

infer product conclusions beyond the existing audit result.

5. Disallowed LLM roles
The following roles are disallowed in v1:

final truth arbiter,

freeform evidence selector without rule constraints,

open-ended architecture judge,

repo-wide autonomous reasoning agent,

confidence generator based only on vibes.

If the model becomes the final authority instead of a constrained assistant, Varinth stops being a verifier.

6. Prompt design rules
6.1 Every prompt must specify the role explicitly
Every system prompt must define:

who the model is in this step,

what its narrow task is,

what it must not do,

what output format it must follow.

No vague role prompts like:

“You are a helpful AI assistant.”

That kind of prompt is for toys, not systems.

6.2 Every prompt must state the non-invention rule
Every model-facing contract should include a direct instruction equivalent to:

Do not invent facts, evidence, file paths, locations, confidence, or missing structure. If information is unavailable, use the schema’s null/omit/unknown behavior.

This should not be implied.
It should be written plainly.

6.3 Every structured prompt must define the exact schema
Do not rely on “return JSON like this” with a loose example if the system actually depends on the structure.

Rule
Use:

explicit JSON schema,

or strongly typed schema definition,

or grammar-constrained output where possible.

If the platform supports schema enforcement, use it.
If not, validate and reject malformed output.

6.4 Every prompt must define ambiguity handling
A major failure mode in extraction systems is that the model fills uncertainty with confident normalization.

Prompts must specify what to do when:

evidence is missing,

claim boundaries are unclear,

a field is required but absent,

confidence cannot be honestly assigned.

Ambiguity handling must be deterministic.

6.5 Prompts must prefer short outputs
Long responses increase drift.

Rule
Outputs should be:

minimal,

structured,

field-bounded,

and free of commentary unless commentary is explicitly requested.

Do not let the model attach essays to structured outputs.

7. Global non-negotiable rules
These rules apply to all LLM-assisted steps.

7.1 No invented evidence
The model must never create file names, line ranges, URLs, config keys, snippets, or artifact references not present in the provided context.

7.2 No invented verdicts
The model must not label a claim supported or contradicted unless the system explicitly allows it in that role and provides the required evidence inputs.

7.3 No silent schema drift
The model must not rename fields, add fields, nest fields differently, or change types.

7.4 No rhetorical upgrades
The model must not turn:

“may use”
into

“uses”

or:

“appears configured for”
into

“is guaranteed to”

This happens constantly in sloppy prompting and it destroys claim integrity.

7.5 No confidence inflation
Confidence must never be decorative.
If confidence exists, it must reflect a real scoring or rule-driven signal, not just fluent wording.

7.6 No chain-of-thought exposure by default
The model should return final structured results, not verbose hidden reasoning dumps. Internal reasoning traces should be deterministic and structured if needed, not freeform mind spill.

8. Schema rules for LLM outputs
Reliable structured-output systems generally work better when the output schema is strict, validated, and explicit about required vs optional fields.

8.1 Required schema properties
All machine-consumable outputs should include:

explicit field names,

stable types,

required vs optional distinction,

enum restrictions where applicable,

and no additional arbitrary keys.

8.2 Optional fields
Optional fields should be omitted rather than fabricated.

Bad:

json
{
  "line_range": "probably around line 50"
}
Good:

json
{
  "line_range": null
}
or omission if the schema allows omission.

8.3 Enum discipline
Where enums exist, the prompt must name the exact allowed values.

Example:

supported

contradicted

unverified

Not:

“choose an appropriate verdict”

That is lazy prompting and it causes garbage outputs.

9. Validation and repair policy
Production-grade structured output systems usually rely on post-generation validation and repair loops instead of blindly trusting raw output.

9.1 Validation must happen outside the model
The system must validate:

JSON shape,

field types,

required fields,

enum validity,

range constraints,

and illegal extra properties.

The model is not the validator.
The model is the producer.

9.2 Repair may be attempted once or in a bounded loop
If output is invalid:

validate,

produce error details,

retry with correction prompt or repair layer,

fail cleanly if still invalid.

Do not create endless self-healing loops.

9.3 Repair must preserve semantics
Repair is allowed to fix:

malformed JSON,

wrong field names,

type mismatches,

missing optional nulls.

Repair is not allowed to change what the claim means.

10. Prompt contract: claim extraction
This is one of the most important prompt contracts in Varinth.

10.1 Role definition
The model is a claim extraction engine.
Its job is to identify atomic, auditable claims from an AI-generated engineering answer.

10.2 Input
Inputs may include:

original question,

answer text,

optional extraction limits,

optional context hints.

10.3 Output schema
Example schema:

json
{
  "claims": [
    {
      "claim_index": 1,
      "raw_text": "This backend uses JWT authentication.",
      "normalized_text": "The backend uses JWT authentication.",
      "claim_type": "structural",
      "importance": "high"
    }
  ]
}
10.4 Extraction rules
The extractor must:

split multi-claim sentences into atomic claims where reasonable,

preserve original meaning,

avoid combining unrelated statements,

exclude fluff that cannot be audited,

avoid paraphrasing into stronger wording.

10.5 Claim extractor prompt template
text
You are a claim extraction engine for an AI answer verification system.

Task:
Extract atomic, auditable claims from the provided answer.

Rules:
- Return only valid JSON matching the required schema.
- Do not invent claims not present in the answer.
- Do not strengthen or weaken the meaning of a claim.
- Split compound statements into smaller independent claims where possible.
- Ignore rhetorical filler, style, and non-verifiable opinion.
- If a statement cannot be meaningfully audited, omit it.
- Allowed claim_type values: structural, config, guarantee, performance, other.
- Allowed importance values: low, medium, high, critical.
- Do not output explanations or commentary.

If information is unclear, preserve the original wording conservatively rather than guessing.
11. Prompt contract: explanation formatter
11.1 Role definition
The model is a verdict explanation formatter.
Its job is to transform structured verdict data into concise human-readable explanation text.

11.2 Input
Inputs may include:

claim text,

verdict,

evidence snippets,

source references,

warning flags.

11.3 Output schema
json
{
  "explanation": "Supported because JWT authentication is configured in backend/auth.py lines 22-61."
}
11.4 Rules
Do not introduce new evidence.

Do not change the verdict.

Do not hedge or exaggerate beyond the verdict.

Keep the explanation short.

Mention evidence only if it exists in the input.

11.5 Explanation formatter prompt template
text
You are a verdict explanation formatter for an AI verification system.

Task:
Write one concise explanation for the provided claim verdict.

Rules:
- Use only the evidence and verdict data provided.
- Do not invent file names, line ranges, technologies, or reasoning.
- Do not change the verdict or imply stronger certainty than the verdict.
- Keep the explanation concise and concrete.
- Return only valid JSON matching the required schema.
12. Prompt contract: repair assistant
12.1 Role definition
The model is a structured output repair assistant.

12.2 Allowed task
Given:

invalid structured output,

schema rules,

validation errors,

it should repair the output into valid schema-compliant JSON.

12.3 Rules
Do not invent missing semantic content.

Preserve meaning.

Fix only what is necessary for validity.

12.4 Repair prompt template
text
You are a structured output repair assistant.

Task:
Repair the provided JSON so it matches the schema exactly.

Rules:
- Do not add new semantic information.
- Do not invent values for unknown fields.
- Preserve existing meaning.
- Remove illegal fields.
- Fix invalid field names or types only when the intended mapping is obvious.
- Return only valid JSON.
13. Confidence handling rules
Confidence is dangerous because teams love to display it even when it means nothing.

13.1 Confidence is optional
Confidence should exist only if it is tied to:

a scoring function,

deterministic heuristics,

or a bounded aggregation over real signals.

13.2 Confidence must not come from style
The model must not generate confidence because text “looks certain.”

13.3 If confidence is unknown, omit it
Do not fake numeric precision.

Bad:

0.84 because the model felt good

Good:

omit the value,

or let a deterministic scoring layer compute it later.

14. Error and fallback behavior
14.1 Invalid structured output
If the model returns invalid structured output:

validate,

optionally repair,

retry once if appropriate,

fail with a structured error if still invalid.

14.2 Empty extraction result
If no auditable claims are found:

return an empty claims list,

include a warning in the surrounding system layer,

do not invent claims to make the output look useful.

14.3 Ambiguous claim text
If a sentence is ambiguous:

preserve its wording conservatively,

or omit it if it cannot be reliably represented.

14.4 Missing evidence in explanation stage
If explanation input lacks evidence, the formatter must not manufacture an explanation pretending evidence exists.

15. Prompt versioning rules
Prompt behavior is part of product behavior.

Rule
Each important prompt family should have:

a prompt identifier,

version number,

change notes if altered materially.

Examples:

claim_extractor_v1

verdict_formatter_v1

repair_json_v1

This matters because once outputs change, evaluation and debugging depend on knowing which prompt version produced them.

16. Testing prompt behavior
Prompted components should be tested like software, not treated like mystical text blobs.

16.1 Test for structure
Does the output match schema?

16.2 Test for non-invention
Does it fabricate missing fields?

16.3 Test for semantic preservation
Did the claim meaning change?

16.4 Test for ambiguity discipline
Does it use omission/null/unknown correctly?

16.5 Test for consistency
Does the same input produce reasonably stable outputs?

Prompt behavior should be evaluated on golden cases just like any other critical system logic.

17. Final prompting philosophy
In Varinth, prompting is not creative writing.
It is systems engineering.

A prompt is good only if it does the following:

narrows the model’s role,

constrains the output shape,

forbids invention,

handles ambiguity honestly,

and produces results that can survive validation and testing.

Anything else is prompt theater.