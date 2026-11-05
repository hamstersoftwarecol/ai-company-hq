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
