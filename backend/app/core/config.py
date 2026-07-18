from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # NVIDIA API
    nvidia_api_key: str
    nvidia_api_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_embed_model: str = "nvidia/nv-embedqa-e5-v5"
    nvidia_chat_model: str = "meta/llama-3.3-70b-instruct"

    # NemoClaw Blueprint Integration (Private On-Premise)
    nemoclaw_enabled: bool = False
    nemoclaw_url: str = "http://localhost:9000/v1"
    nemoclaw_chat_model: str = "nvidia/nemotron-4-340b-instruct"
    nemoclaw_embed_model: str = "nvidia/nv-embed-qa"

    # CORS
    allowed_origins: str = "http://localhost:3000"

    # Runtime limits
    log_level: str = "INFO"
    max_claims_per_run: int = 20
    max_answer_len: int = 10000
    max_question_len: int = 2000
    max_files_per_scope: int = 500
    max_file_size_kb: int = 512

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
