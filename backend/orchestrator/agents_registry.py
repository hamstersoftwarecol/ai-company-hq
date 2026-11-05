"""Agents created by the user from the office (besides the built-in crews)."""
import json
import os
import re
import tempfile
import unicodedata
from pathlib import Path

BUILTIN_CREWS = ["marketing", "frontend", "backend", "mobile", "images", "planning"]
RESERVED_KEYS = set(BUILTIN_CREWS) | {"orchestrator", "custom"}
MAX_CUSTOM_AGENTS = 4  # one desk slot each in the office

AGENTS_PATH = Path(os.getenv("AGENTS_FILE", Path(__file__).resolve().parent.parent / "data" / "agents.json"))

_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _read() -> list[dict]:
    try:
        data = json.loads(AGENTS_PATH.read_text())
    except (OSError, ValueError):
        return []
    return [a for a in data if isinstance(a, dict) and {"key", "label", "role", "color"} <= a.keys()] if isinstance(data, list) else []


def _write(agents: list[dict]) -> None:
    AGENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mktemp(dir=AGENTS_PATH.parent, suffix=".tmp"))
    tmp.write_text(json.dumps(agents, ensure_ascii=False, indent=1))
    tmp.replace(AGENTS_PATH)


def list_agents() -> list[dict]:
    return _read()


def get_agent(key: str) -> dict | None:
    return next((a for a in _read() if a["key"] == key), None)


def crew_names() -> list[str]:
    """Every crew that can receive work: the built-in ones plus the user's agents."""
    return BUILTIN_CREWS + [a["key"] for a in _read()]


def _slug(label: str) -> str:
    ascii_label = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_label.lower()).strip("-") or "agente"


def add_agent(label: str, role: str, color: str) -> dict:
    """Create an agent. Raises ValueError with a message for the user if something is invalid."""
    label, role, color = (label or "").strip(), (role or "").strip(), (color or "").strip()
    if not 1 <= len(label) <= 20:
        raise ValueError("Ponle un nombre de hasta 20 caracteres.")
    if not 5 <= len(role) <= 2000:
        raise ValueError("Cuéntale qué debe hacer (entre 5 y 2000 caracteres).")
    if not _COLOR_RE.match(color):
        raise ValueError("Elige un color válido.")
    agents = _read()
    if len(agents) >= MAX_CUSTOM_AGENTS:
        raise ValueError(f"Solo hay sitio para {MAX_CUSTOM_AGENTS} agentes propios. Borra alguno primero.")
    taken = RESERVED_KEYS | {a["key"] for a in agents}
    base = _slug(label)
    key, n = base, 2
    while key in taken:
        key, n = f"{base}-{n}", n + 1
    agent = {"key": key, "label": label, "role": role, "color": color}
    _write(agents + [agent])
    return agent


def delete_agent(key: str) -> None:
    """Delete an agent. Raises KeyError if it does not exist."""
    agents = _read()
    if not any(a["key"] == key for a in agents):
        raise KeyError(key)
    _write([a for a in agents if a["key"] != key])
