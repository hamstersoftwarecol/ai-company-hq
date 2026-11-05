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
