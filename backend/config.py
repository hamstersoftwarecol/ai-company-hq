import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    anthropic_api_key: str
    openai_api_key: str
    ollama_base_url: str
    default_local_model: str
    default_remote_model: str

    def __post_init__(self) -> None:
        if not self.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY must not be empty")
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY must not be empty")


def get_settings() -> Settings:
    return Settings(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        default_local_model=os.getenv("DEFAULT_LOCAL_MODEL", "llama3.2"),
        default_remote_model=os.getenv("DEFAULT_REMOTE_MODEL", "claude-sonnet-4-5"),
    )
