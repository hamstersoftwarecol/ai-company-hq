import os
import re
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(_ENV_PATH)


@dataclass
class Settings:
    anthropic_api_key: str
    openai_api_key: str
    ollama_base_url: str
    default_local_model: str
    default_remote_model: str


def get_settings() -> Settings:
    return Settings(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        default_local_model=os.getenv("DEFAULT_LOCAL_MODEL", "llama3.2"),
        default_remote_model=os.getenv("DEFAULT_REMOTE_MODEL", "claude-sonnet-5-5"),
    )


def save_api_keys(anthropic_key: str | None, openai_key: str | None) -> None:
    """Write API keys into .env, creating it if it doesn't exist."""
    text = _ENV_PATH.read_text() if _ENV_PATH.exists() else ""
    if anthropic_key is not None:
        text = _upsert_env_var(text, "ANTHROPIC_API_KEY", anthropic_key)
        os.environ["ANTHROPIC_API_KEY"] = anthropic_key
    if openai_key is not None:
        text = _upsert_env_var(text, "OPENAI_API_KEY", openai_key)
        os.environ["OPENAI_API_KEY"] = openai_key
    _ENV_PATH.write_text(text)


def _upsert_env_var(text: str, key: str, value: str) -> str:
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    new_line = f"{key}={value}"
    if pattern.search(text):
        return pattern.sub(new_line, text)
    separator = "\n" if text and not text.endswith("\n") else ""
    return text + separator + new_line + "\n"
