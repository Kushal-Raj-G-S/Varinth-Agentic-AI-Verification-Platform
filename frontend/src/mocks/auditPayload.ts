import { AuditRun } from '../types/audit';

export const MOCK_SUCCESS_PAYLOAD: AuditRun = {
  audit_run_id: 'de16e915-0b1a-409a-881b-843684c35131',
  user_id: '436ff474-c855-42d1-bf94-21ca4c6456e2',
  source_context_id: 'c855-42d1-bf94-21ca4c64',
  question_text: 'How is session storage configured?',
  answer_text: 'The backend uses Redis for session caching with a 24-hour TTL default. All queries are parameterized.',
  status: 'completed',
  global_score: 100.0,
  started_at: '2026-07-15T01:48:35.000Z',
  completed_at: '2026-07-15T01:49:07.000Z',
  duration_ms: 32000,
  clone_duration_ms: 8000,
  retrieval_duration_ms: 6000,
  verification_duration_ms: 17000,
  persistence_duration_ms: 1000,
  claims: [
    {
      "claim_id": "48075f79-73e1-4311-a0e6-a1a72cc87959",
      "audit_run_id": "de16e915-0b1a-409a-881b-843684c35131",
      "claim_index": 0,
      "raw_text": "The backend uses Redis for session caching with a 24-hour TTL default.",
      "normalized_query": "Redis session cache with 24h TTL",
      "status": "processed",
      "verdict": "supported",
      "confidence": 0.98,
      "judge_explanation": "Verified in backend/app/core/redis.py where Redis session TTL is set to 86400 seconds (24 hours).",
      "contradiction_reason": null,
      "created_at": "2026-07-15T01:48:40.000Z",
      "evidence_items": [
        {
          "evidence_id": "f002b068-7d72-4670-43c2-dff7a9570e41",
          "claim_id": "48075f79-73e1-4311-a0e6-a1a72cc87959",
          "filepath": "backend/app/core/redis.py",
          "start_line": 30,
          "end_line": 38,
          "snippet_text": "def get_redis_session_store():\n    return RedisStore(\n        host=settings.REDIS_HOST,\n        port=settings.REDIS_PORT,\n        expire_seconds=86400  # 24 hour TTL\n    )",
          "relevance_score": 0.96,
          "retrieval_method": "semantic",
          "source_commit": "de16e9150000",
          "source_branch": "main",
          "language": "python",
          "rank": 0
        }
      ]
    },
    {
      "claim_id": "48075f79-73e1-4311-a0e6-a1a72cc87960",
      "audit_run_id": "de16e915-0b1a-409a-881b-843684c35131",
      "claim_index": 1,
      "raw_text": "All queries are parameterized.",
      "normalized_query": "Database queries parameterized statements",
      "status": "processed",
      "verdict": "supported",
      "confidence": 0.95,
      "judge_explanation": "Checked DB query statements in queries.py. All SQL queries use binding parameters.",
      "contradiction_reason": null,
      "created_at": "2026-07-15T01:48:41.000Z",
      "evidence_items": [
        {
          "evidence_id": "f002b068-7d72-4670-43c2-dff7a9570e42",
          "claim_id": "48075f79-73e1-4311-a0e6-a1a72cc87960",
          "filepath": "backend/app/db/queries.py",
          "start_line": 12,
          "end_line": 16,
          "snippet_text": "def get_user_by_email(db, email: str):\n    return db.execute(\n        \"SELECT * FROM users WHERE email = :email\",\n        {\"email\": email}\n    ).fetchone()",
          "relevance_score": 0.94,
          "retrieval_method": "semantic",
          "source_commit": "de16e9150000",
          "source_branch": "main",
          "language": "python",
          "rank": 0
        }
      ]
    }
  ],
  warnings: []
};

export const MOCK_PARTIAL_PAYLOAD: AuditRun = {
  audit_run_id: 'a2e8c56d-0b1a-409a-881b-843684c35131',
  user_id: '436ff474-c855-42d1-bf94-21ca4c6456e2',
  source_context_id: 'c855-42d1-bf94-21ca4c64',
  question_text: 'Are JWT tokens and rate limiting persisted?',
  answer_text: 'JWT tokens expire after 30 days. Rate limiting state persists between server restarts.',
  status: 'partial',
  global_score: 50.0,
  started_at: '2026-07-15T01:52:00.000Z',
  completed_at: '2026-07-15T01:52:40.000Z',
  duration_ms: 40000,
  claims: [
    {
      "claim_id": "2c1c0b86-e0af-4e6d-9174-f002b0687d72",
      "audit_run_id": "a2e8c56d-0b1a-409a-881b-843684c35131",
      "claim_index": 0,
      "raw_text": "JWT tokens expire after 30 days.",
      "normalized_query": "JWT token expiration configuration",
      "status": "processed",
      "verdict": "contradicted",
      "confidence": 0.99,
      "judge_explanation": "The claim states that JWT tokens expire in 30 days, but configuration in security.py explicitly sets the expiration to 7 days.",
      "contradiction_reason": "Code configuration sets token expiration to 7 days, not 30.",
      "created_at": "2026-07-15T01:52:05.000Z",
      "evidence_items": [
        {
          "evidence_id": "f002b068-7d72-4670-43c2-dff7a9570e43",
          "claim_id": "2c1c0b86-e0af-4e6d-9174-f002b0687d72",
          "filepath": "backend/app/core/security.py",
          "start_line": 105,
          "end_line": 110,
          "snippet_text": "def create_access_token(data: dict):\n    # JWT token configuration\n    expires_delta = timedelta(days=7)  # 7 days expiration\n    expire = datetime.utcnow() + expires_delta",
          "relevance_score": 0.97,
          "retrieval_method": "semantic",
          "source_commit": "a2e8c56d0000",
          "source_branch": "main",
          "language": "python",
          "rank": 0
        }
      ]
    },
    {
      "claim_id": "2c1c0b86-e0af-4e6d-9174-f002b0687d73",
      "audit_run_id": "a2e8c56d-0b1a-409a-881b-843684c35131",
      "claim_index": 1,
      "raw_text": "Rate limiting state persists between server restarts.",
      "normalized_query": "Rate limit storage persistence restart",
      "status": "skipped",
      "verdict": "unverified",
      "confidence": 0.0,
      "judge_explanation": "No relevant files or state backup stores were matched to support rate-limit state persistence.",
      "contradiction_reason": null,
      "created_at": "2026-07-15T01:52:06.000Z",
      "evidence_items": []
    }
  ],
  "warnings": [
    {
      "warning_code": "RETRIEVAL_TIMEOUT",
      "message": "Evidence retrieval timed out for claim 1 due to backend worker overload."
    }
  ]
};

export const MOCK_FAILED_PAYLOAD: AuditRun = {
  audit_run_id: 'd4f8a10b-0b1a-409a-881b-843684c35131',
  user_id: '436ff474-c855-42d1-bf94-21ca4c6456e2',
  source_context_id: 'c855-42d1-bf94-21ca4c64',
  question_text: 'Verify the python app setup',
  answer_text: 'FastAPI with SQLite',
  status: 'failed',
  global_score: null,
  started_at: '2026-07-15T01:55:00.000Z',
  completed_at: '2026-07-15T01:55:05.000Z',
  duration_ms: 5000,
  claims: [],
  warnings: [],
  failure: {
    failure_code: 'CLONE_FAILED',
    error_message: 'Failed to clone remote git repository. Error: Repository not found.'
  }
};

export const MOCK_IN_FLIGHT_PAYLOAD: AuditRun = {
  audit_run_id: 'e5f8a10b-0b1a-409a-881b-843684c35132',
  user_id: '436ff474-c855-42d1-bf94-21ca4c6456e2',
  source_context_id: 'c855-42d1-bf94-21ca4c64',
  question_text: 'Verify code optimization modules',
  answer_text: 'Using asyncio for database reads and writes.',
  status: 'verifying',
  global_score: null,
  started_at: '2026-07-15T02:10:00.000Z',
  duration_ms: null,
  claims: [],
  warnings: []
};

export const MOCK_EMPTY_PAYLOAD: AuditRun = {
  audit_run_id: 'f6f8a10b-0b1a-409a-881b-843684c35133',
  user_id: '436ff474-c855-42d1-bf94-21ca4c6456e2',
  source_context_id: 'c855-42d1-bf94-21ca4c64',
  question_text: 'Hello!',
  answer_text: 'Hi there, how can I help you today?',
  status: 'completed',
  global_score: 100.0,
  started_at: '2026-07-15T02:15:00.000Z',
  completed_at: '2026-07-15T02:15:04.000Z',
  duration_ms: 4000,
  claims: [],
  warnings: []
};
