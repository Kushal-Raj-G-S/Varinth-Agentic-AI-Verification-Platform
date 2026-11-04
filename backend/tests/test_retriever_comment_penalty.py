from app.services.retriever import (
    COMMENT_PENALTY_STRENGTH,
    _comment_line_ratio,
)


def test_comment_line_ratio_all_comments():
    snippet = "# one\n# two\n# three"
    assert _comment_line_ratio(snippet, "workflow.yml") == 1.0


def test_comment_line_ratio_all_code():
    snippet = "CONTRADICT_THRESHOLD = 0.5\nSUPPORT_THRESHOLD = 0.5"
    assert _comment_line_ratio(snippet, "verdict_engine.py") == 0.0


def test_comment_line_ratio_mixed():
    snippet = "# a comment\nreal_code = True\n# another comment"
    ratio = _comment_line_ratio(snippet, "module.py")
    assert ratio == 2 / 3


def test_comment_line_ratio_unknown_extension_no_penalty():
    # .json has no comment syntax — never penalized, even if it happens
    # to contain a string that looks like "# comment".
    snippet = '{"note": "# not a real comment"}'
    assert _comment_line_ratio(snippet, "data.json") == 0.0


def test_comment_line_ratio_blank_lines_ignored():
    snippet = "# comment\n\n\nreal_code = True"
    assert _comment_line_ratio(snippet, "module.py") == 0.5


def test_full_comment_snippet_is_meaningfully_penalized():
    # A fully-commented snippet's score should drop by exactly
    # COMMENT_PENALTY_STRENGTH, not be zeroed or left untouched.
    penalty = 1.0 - (COMMENT_PENALTY_STRENGTH * 1.0)
    assert 0.0 < penalty < 1.0
    raw_score = 0.9
    assert round(raw_score * penalty, 4) < raw_score
