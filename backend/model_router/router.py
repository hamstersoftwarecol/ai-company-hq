import os
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_LOCAL_MODEL = os.getenv("DEFAULT_LOCAL_MODEL", "llama3.2")

AGENT_TIER_MAP: dict[str, str] = {
    # Critical — remote Claude
    "ceo_agent": "critical",
    "frontend_architect": "critical",
    "backend_architect": "critical",
    "mobile_developer": "critical",
    # Standard — GPT-4o
    "marketing_strategist": "standard",
    "project_planner": "standard",
    # Local — Ollama
    "reels_creator": "local",
    "analytics_agent": "local",
    "mobile_qa": "local",
    "prompt_engineer": "local",
    "resource_manager": "local",
    "frontend_developer": "local",
    "backend_developer": "local",
    "image_generator": "local",
}

TIER_MODEL_MAP: dict[str, str] = {
    "critical": "claude-sonnet-5-5",
    "standard": "gpt-4o",
    "local": f"ollama/{DEFAULT_LOCAL_MODEL}",
}


def _ollama_available() -> bool:
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=1) as resp:
            return resp.status == 200
    except Exception:
        return False


def get_model_for_agent(agent_name: str) -> str:
    tier = AGENT_TIER_MAP.get(agent_name, "local")
    if tier == "local" and not _ollama_available():
        return TIER_MODEL_MAP["standard"]
    return TIER_MODEL_MAP[tier]
