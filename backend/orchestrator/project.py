"""Project folder handling: where the agents are allowed to work."""
from pathlib import Path


def resolve_project_dir(raw: str) -> Path:
    """Validate the folder the user chose and create it if it does not exist.

    The folder must be inside the user's home directory (and not the home itself,
    not a hidden folder, not ~/Library), because the agents get permission to
    create and edit files there.
    """
    raw = (raw or "").strip()
    if not raw:
        raise ValueError("Escribe la carpeta donde se desarrollará el proyecto.")
    path = Path(raw).expanduser()
    if not path.is_absolute():
        raise ValueError("Escribe una ruta completa, por ejemplo ~/Documents/mi-proyecto.")
    path = path.resolve()
    home = Path.home().resolve()
    if path == home or home not in path.parents:
        raise ValueError("La carpeta debe estar dentro de tu carpeta personal (~), sin ser la carpeta personal misma.")
    parts = path.relative_to(home).parts
    if any(p.startswith(".") for p in parts) or parts[0] == "Library":
        raise ValueError("No uses carpetas ocultas ni ~/Library.")
    if path.exists() and not path.is_dir():
        raise ValueError("Esa ruta es un archivo, no una carpeta.")
    path.mkdir(parents=True, exist_ok=True)
    return path


def _browsable(raw: str | None) -> Path:
    """Resolve a folder to browse: the home directory or something inside it (no hidden, no ~/Library)."""
    home = Path.home().resolve()
    path = Path(raw).expanduser().resolve() if raw else home
    if path != home:
        if home not in path.parents:
            raise ValueError("Solo puedes explorar carpetas dentro de tu carpeta personal (~).")
        parts = path.relative_to(home).parts
        if any(p.startswith(".") for p in parts) or parts[0] == "Library":
            raise ValueError("No se pueden explorar carpetas ocultas ni ~/Library.")
    if not path.is_dir():
        raise ValueError("Esa carpeta no existe.")
    return path


def list_folders(raw: str | None = None) -> dict:
    """Sub-folders of `raw` (default: home) for the folder picker. Files are never listed."""
    home = Path.home().resolve()
    path = _browsable(raw)
    folders = []
    for child in sorted(path.iterdir(), key=lambda c: c.name.lower()):
        if child.name.startswith(".") or (path == home and child.name == "Library"):
            continue
        try:
            if child.is_dir() and not child.is_symlink():
                folders.append({"name": child.name, "path": str(child)})
        except OSError:
            continue
        if len(folders) >= 500:
            break
    return {
        "path": str(path),
        "home": str(home),
        "parent": str(path.parent) if path != home else None,
        "folders": folders,
    }


def create_folder(parent: str, name: str) -> Path:
    """Create `name` inside `parent` (both inside ~) and return it."""
    name = (name or "").strip()
    if not name or "/" in name or "\\" in name or name.startswith(".") or len(name) > 100:
        raise ValueError("Escribe un nombre de carpeta válido (sin barras ni punto al inicio).")
    base = _browsable(parent)
    return resolve_project_dir(str(base / name))


# ── The current project (asked once, remembered) ─────────────────────────────
import json
import os
import shutil
import subprocess
import tempfile
from datetime import date

PROJECT_PATH = Path(os.getenv("PROJECT_FILE", Path(__file__).resolve().parent.parent / "data" / "project.json"))


def get_project() -> str | None:
    """The folder of the current project, or None if none was chosen yet (or it is no longer valid)."""
    try:
        folder = json.loads(PROJECT_PATH.read_text()).get("folder")
        return str(resolve_project_dir(folder)) if folder else None
    except (OSError, ValueError, AttributeError):
        return None


def set_project(folder: str) -> str:
    """Remember `folder` (validated, created if missing) as the current project."""
    path = resolve_project_dir(folder)
    PROJECT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mktemp(dir=PROJECT_PATH.parent, suffix=".tmp"))
    tmp.write_text(json.dumps({"folder": str(path)}))
    tmp.replace(PROJECT_PATH)
    return str(path)


def clear_project() -> None:
    PROJECT_PATH.unlink(missing_ok=True)


def initialize_project(folder: str, instruction: str, plan: list[dict]) -> list[str]:
    """Set up a new project folder: one subfolder per crew in the plan, a README with the
    approved plan, and `git init` (unless the folder already is inside a repository).
    Never overwrites anything. Returns what it did, in plain Spanish."""
    root = Path(folder)
    done: list[str] = []
    crews = list(dict.fromkeys(str(item.get("crew", "")) for item in plan if item.get("crew")))
    names = ["docs"] + [("docs" if c == "planning" else c) for c in crews]
    created = []
    for name in dict.fromkeys(names):
        if not (root / name).exists():
            (root / name).mkdir()
            created.append(f"{name}/")
    if created:
        done.append("carpetas " + ", ".join(created))

    readme = root / "README.md"
    if not readme.exists():
        lines = [
            f"# {instruction.strip().splitlines()[0][:80] if instruction.strip() else 'Proyecto'}",
            "",
            f"> Proyecto creado con Mi Oficina Virtual · Hamster Software el {date.today().isoformat()}.",
            "",
            "## Objetivo",
            "",
            instruction.strip(),
            "",
            "## Plan aprobado",
            "",
            *[f"- **{item.get('crew')}**: {item.get('task')}" for item in plan],
            "",
        ]
        readme.write_text("\n".join(lines))
        done.append("README.md")

    git = shutil.which("git")
    if git and not (root / ".git").exists():
        try:
            inside = subprocess.run([git, "rev-parse", "--is-inside-work-tree"], cwd=root,
                                    capture_output=True, timeout=15).returncode == 0
            if not inside and subprocess.run([git, "init", "-q"], cwd=root, capture_output=True, timeout=15).returncode == 0:
                done.append("repositorio git")
        except (OSError, subprocess.SubprocessError):
            pass
    return done
