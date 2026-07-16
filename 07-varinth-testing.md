Varinth – Testing, Evaluation & Acceptance Strategy
1. Purpose of this document
This document defines how Varinth will be tested, evaluated, and accepted as a working verification product. It covers:

test philosophy,

testing layers,

fixture design,

evaluation metrics,

acceptance criteria,

and failure analysis.

Varinth is not just a backend service. It is a system that makes truth claims about other systems. That means it needs a stronger testing discipline than a normal CRUD app. Traditional software testing distinguishes between verification and validation, with testing layered from unit to integration to system and acceptance testing, and that structure fits Varinth well because both its individual modules and its end-to-end trustworthiness must be validated.

2. Testing philosophy
Varinth needs two kinds of confidence:

Software correctness

Does the system behave as designed?

Do its modules produce valid outputs?

Does the protocol integration work?

Verification correctness

Does the system make good claim-level judgments?

Does it attach the right evidence?

Does it avoid fake certainty?

The first is normal engineering. The second is the hard part.

2.1 Core testing principle
Varinth should be tested as both:

a software product, and

a fact-verification engine.

If you only test the API, you prove nothing about truth quality.
If you only test the outputs semantically, you risk building a brittle mess.

You need both.

2.2 Evidence-first quality rule
A “good-looking” result is not enough. Tests must explicitly verify that:

supported claims include evidence,

contradicted claims include contradicting evidence,

unverified is used honestly when evidence is weak or absent.

This is the central trust rule of the product.

3. Test levels
Software testing is commonly organized into layers such as unit, integration, system, and acceptance testing; using that layered approach reduces the chance of pushing all failure discovery to the end.

3.1 Unit testing
Unit tests verify small components in isolation.

For Varinth, unit tests should target:

input validation,

claim extraction normalization,

evidence ranking logic,

verdict rules,

config resolution,

error handling.

Goal: verify internal correctness of modules without requiring the full system.

3.2 Integration testing
Integration tests verify that subsystems work correctly together.

For Varinth, integration tests should target:

MCP adapter + request orchestrator,

claim extraction + retrieval,

retrieval + verdict engine,

persistence + audit replay,

guardrails + output validation.

Goal: verify that the interfaces between components do not break the verification pipeline.

3.3 System testing
System tests verify the full end-to-end application under realistic conditions.

For Varinth, system tests should target:

full question + answer + source config → audit JSON pipeline,

realistic repo structures,

realistic Claude/Cursor-style request patterns,

logs and output generation,

degraded/error behavior.

Goal: verify that Varinth functions as a complete product.

3.4 Acceptance testing
Acceptance testing verifies whether Varinth actually meets the intended product requirements. Acceptance tests typically validate whether the system behaves in a way that can reasonably be expected by the end user or customer.

For Varinth, acceptance tests should answer:

Does it audit real AI answers about a repo in a credible way?

Does it catch obvious hallucinations?

Does it avoid claiming certainty without evidence?

Does it fit naturally into the intended developer workflow?

Goal: prove the product is not just technically working, but actually useful.

4. Test pyramid for Varinth
Varinth should follow a practical test pyramid strategy: many unit tests, fewer integration tests, fewer full-stack tests, and a small number of high-value acceptance scenarios. That is the normal healthy balance for maintainable software systems.

4.1 Recommended balance
Unit tests: many

Integration tests: moderate

System tests: fewer but important

Acceptance tests: small number, high realism

4.2 Why this matters
If you rely only on end-to-end evaluations, debugging becomes painful and slow.
If you rely only on unit tests, you miss the real failure modes of the verification chain.

The correct move is balance.

5. Test artifact strategy
Varinth needs well-designed fixtures and golden evaluation sets.

5.1 Test artifact categories
Varinth should maintain the following artifact sets:

5.1.1 Synthetic-but-realistic unit fixtures
These are small controlled samples for module testing.

Examples:

tiny answer texts with 2–3 claims,

small code snippets,

simple config files,

exact expected outputs.

Use these for deterministic unit tests.

5.1.2 Golden integration fixtures
These are medium-sized test cases that simulate realistic engineering verification scenarios.

Each fixture should include:

a question,

an AI-generated answer,

source artifacts,

expected claims,

expected verdicts,

expected evidence references.

These are the backbone of integration testing.

5.1.3 End-to-end benchmark repos
These are small full repos or repo snapshots designed for realistic system tests.

Each benchmark repo should include:

a clear architecture,

real docs/configs,

several easy-to-verify truths,

several easy-to-catch false claims,

ambiguous claims that should land as unverified.

This gives you realistic evaluation without using giant chaotic repos too early.

6. Golden dataset design
Fact-verification research often uses claim-plus-evidence supervision, where systems are judged not only by label accuracy but by whether they retrieve the right supporting evidence. That is exactly the right mental model for Varinth.

6.1 Golden sample structure
Each golden case should have:

case_id

question

answer

expected_claims

expected_verdicts

expected_evidence_refs

optional notes

6.2 Example golden case
json
{
  "case_id": "case_auth_001",
  "question": "Explain how authentication works in this backend.",
  "answer": "This backend uses JWT authentication, stores sessions in Redis, and enforces role-based access control.",
  "expected_claims": [
    "This backend uses JWT authentication.",
    "This backend stores sessions in Redis.",
    "This backend enforces role-based access control."
  ],
  "expected_verdicts": {
    "This backend uses JWT authentication.": "supported",
    "This backend stores sessions in Redis.": "contradicted",
    "This backend enforces role-based access control.": "unverified"
  },
  "expected_evidence_refs": {
    "This backend uses JWT authentication.": ["backend/auth/jwt.py"],
    "This backend stores sessions in Redis.": ["config/.env.example"],
    "This backend enforces role-based access control.": []
  }
}
6.3 Golden-case design rules
Each case should include a mix of:

clearly true claims,

clearly false claims,

ambiguous claims,

overconfident performance claims.

If every test case is too easy, the system will look better than it is.

7. Unit test specification
7.1 Input validation tests
Verify:

missing question is rejected,

missing answer is rejected,

invalid max_claims is rejected,

unknown context IDs return structured config errors.

7.2 Claim extraction tests
Verify:

multi-sentence answers split into atomic claims correctly,

duplicate claims are normalized,

claim types are assigned correctly when obvious,

non-verifiable fluff is ignored or downgraded.

7.3 Evidence retrieval tests
Verify:

matching source files are found,

scope restriction works,

line/snippet extraction is accurate,

retrieval never escapes allowed paths.

7.4 Verdict engine tests
Verify:

supported claims require evidence,

contradicted claims require contradictory evidence,

ambiguous evidence leads to unverified,

unsupported performance claims do not get upgraded to supported.

7.5 Persistence tests
Verify:

audit runs are stored,

claim/evidence/verdict links are preserved,

logs can be replayed,

partial failures are recorded cleanly.

8. Integration test specification
8.1 Extraction + retrieval integration
Given an answer and a configured repo, the system should:

extract claims,

retrieve evidence,

preserve claim-to-evidence alignment.

8.2 Retrieval + verdict integration
Given a claim and evidence bundle, the system should:

assign a valid verdict,

include explanation metadata,

produce deterministic output for the same input.

8.3 MCP adapter + core pipeline integration
Given a valid MCP request, the system should:

parse the input,

run the audit,

return schema-valid JSON.

8.4 Logging integration
Given a completed or failed run, the system should:

write a valid audit record,

include IDs and timing metadata,

record warnings and truncation state.

9. System test specification
System testing verifies the whole product under realistic operating conditions.

9.1 Full pipeline system test
Input:

question,

answer,

configured local repo,

source scope.

Expected:

valid full JSON response,

all claims assigned verdicts,

evidence attached where required,

logs written.

9.2 Large-answer system test
Input:

long answer containing many claims.

Expected:

system respects max_claims,

response includes warnings if truncated,

no crash,

stable schema output.

9.3 Misconfigured source system test
Input:

valid question/answer,

invalid or missing source scope.

Expected:

structured config error,

no undefined behavior,

no silent fallback to arbitrary directories.

9.4 Partial-failure system test
Input:

repo partly accessible,

one retrieval backend fails.

Expected:

degraded but valid response where possible,

warnings emitted,

logs preserve failure trace.

10. Acceptance test scenarios
Acceptance tests should be written like product-level user stories rather than low-level implementation tests.

10.1 Acceptance scenario A – catches obvious hallucination
Given:

a repo with no Celery usage,

When:

the AI answer says “This project uses Celery workers for background jobs,”

Then:

Varinth should mark that claim as contradicted or unverified depending on evidence strength,

and must not mark it supported.

Success condition:

obvious hallucinations do not survive the audit.

10.2 Acceptance scenario B – confirms grounded explanation
Given:

a repo with clear JWT auth code,

When:

the AI answer says “This backend uses JWT authentication,”

Then:

Varinth should mark it supported,

and attach direct evidence.

Success condition:

true claims are not unfairly suppressed.

10.3 Acceptance scenario C – handles ambiguity honestly
Given:

a repo where RBAC is not clearly documented or implemented,

When:

the AI answer claims “This project enforces role-based access control,”

Then:

Varinth should return unverified,

not force a false certainty.

Success condition:

uncertainty is preserved honestly.

10.4 Acceptance scenario D – works inside MCP workflow
Given:

Claude Desktop or Cursor configured with Varinth,

When:

the user invokes the tool on a previous answer,

Then:

Varinth returns schema-valid audit output,

and the user can see the result in the client workflow.

Success condition:

product fits the intended usage surface.

11. Evaluation metrics
Varinth is a claim verification engine, so its evaluation should borrow from factuality and evidence-based verification thinking rather than generic API testing. Fact verification benchmarks such as FEVER focus on label correctness plus evidence grounding, while newer factuality work emphasizes not just precision but also coverage/recall of important facts.

11.1 Claim verdict accuracy
Measure how often the predicted verdict matches the gold verdict.

Formula:

correct verdicts / total evaluated claims

Useful, but not enough by itself.

11.2 Evidence precision
Measure how often retrieved evidence is actually relevant to the claim.

This matters because a system can “look grounded” while attaching junk snippets.

11.3 Evidence recall
Measure whether the system successfully retrieves at least one valid supporting or contradicting evidence item when one exists in the source set.

This is critical. A verification system with bad retrieval is dead on arrival.

11.4 False support rate
Measure the fraction of claims incorrectly marked supported.

This should be treated as a top-tier risk metric.

Why? Because false positive support destroys trust faster than extra unverified labels.

11.5 Honest uncertainty rate
Measure how often ambiguous claims are correctly labeled unverified instead of being forced into support/contradiction.

This is one of the most important product-quality signals.

11.6 Coverage-aware evaluation
Not all claims are equally important. Recent factuality research argues that evaluation should measure both precision and recall, especially for important content, rather than rewarding only safe under-generation.

For Varinth, this means later evaluation should weight:

core architecture claims,

security claims,

database claims,

infra claims,

more heavily than low-value decorative statements.

12. Suggested target metrics for v1
These are internal goals, not public marketing claims.

12.1 Minimum quality bar
For a small curated benchmark set:

claim verdict accuracy: at least 80%

false support rate: near 0% preferred

evidence precision: high enough that most returned snippets are genuinely useful

supported-without-evidence count: exactly 0

12.2 Why false support matters most
If Varinth overuses unverified, it feels conservative.
If Varinth falsely stamps bad claims as supported, it becomes useless.

So your bias should be:

conservative > flashy

That is the correct tradeoff for v1.

13. Regression testing strategy
Every time you change:

claim extraction prompts,

retrieval ranking,

verdict rules,

source parsing logic,

or guardrail behavior,

you should run the golden dataset again.

13.1 Regression suite contents
The regression suite should include:

easy truths,

easy contradictions,

ambiguous claims,

long-answer cases,

edge-case config failures.

13.2 Regression pass rule
No change should be accepted if it:

increases false support rate,

breaks schema stability,

or degrades core golden-case accuracy without explicit reason.

14. Adversarial testing
Varinth should be attacked on purpose.

14.1 Adversarial input categories
Test answers that are:

overly confident,

vague but plausible,

partially true with exaggerated conclusions,

full of copied terminology from the repo but wrong in meaning,

packed with fake performance guarantees.

14.2 Goal of adversarial tests
The goal is to answer one brutal question:

Can Varinth resist being fooled by a polished bullshit answer?

If not, you’re not building a verifier. You’re building a formatter.

15. Observability during testing
The system should emit enough structured telemetry during tests to explain failures.

Recommended logged fields:

audit_run_id,

extracted claim count,

retrieval hit count per claim,

verdict path/rule trace,

warnings,

runtime duration.

This is the difference between “test failed” and “here’s why it failed.”

16. Exit criteria for v1
Varinth v1 is test-ready for broader use only when all of the following are true:

unit test suite passes,

integration suite passes,

core system tests pass,

MCP contract is schema-stable,

golden benchmark quality is acceptable,

false support rate is low enough to trust,

supported-without-evidence count is zero,

acceptance scenarios succeed in a real MCP workflow.

Until then, it is still a prototype.

17. Final testing rule
Varinth should be judged by one ruthless standard:

When the system says “supported,” a strong engineer should be able to inspect the evidence and say, “yeah, that checks out.”

If your tests do not enforce that standard, they’re decoration.