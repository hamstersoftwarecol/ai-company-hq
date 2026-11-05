import pytest
from orchestrator.project import resolve_project_dir


@pytest.fixture(autouse=True)
def fake_home(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    return tmp_path


def test_creates_and_returns_folder_inside_home(fake_home):
    path = resolve_project_dir("~/Documents/proyecto")
    assert path == fake_home.resolve() / "Documents" / "proyecto" and path.is_dir()


@pytest.mark.parametrize("raw", ["", "   ", "relativa/carpeta", "/etc", "/tmp/x", "~", "~/.ssh/proyecto", "~/Library/x"])
def test_rejects_unsafe_or_invalid_paths(raw):
    with pytest.raises(ValueError):
        resolve_project_dir(raw)


def test_rejects_dotdot_escape(fake_home):
    with pytest.raises(ValueError):
        resolve_project_dir("~/Documents/../../outside")


def test_rejects_existing_file(fake_home):
    (fake_home / "archivo").write_text("x")
    with pytest.raises(ValueError):
        resolve_project_dir("~/archivo")


def test_list_folders_hides_files_hidden_and_library(fake_home):
    from orchestrator.project import list_folders
    for d in ("Documents", "alpha", ".ssh", "Library"):
        (fake_home / d).mkdir()
    (fake_home / "nota.txt").write_text("x")
    out = list_folders()
    assert [f["name"] for f in out["folders"]] == ["alpha", "Documents"]  # case-insensitive order
    assert out["parent"] is None and out["path"] == str(fake_home.resolve())


def test_list_folders_inside_home_has_parent_and_rejects_outside(fake_home):
    from orchestrator.project import list_folders
    (fake_home / "Documents" / "app").mkdir(parents=True)
    out = list_folders("~/Documents")
    assert out["parent"] == str(fake_home.resolve()) and [f["name"] for f in out["folders"]] == ["app"]
    for bad in ("/etc", "~/Documents/../../x", "~/.ssh", "~/Library", "~/no-existe"):
        with pytest.raises(ValueError):
            list_folders(bad)


def test_create_folder_and_rejects_bad_names(fake_home):
    from orchestrator.project import create_folder
    path = create_folder("~", "mi-app")
    assert path == fake_home.resolve() / "mi-app" and path.is_dir()
    for bad in ("", "  ", "a/b", "..", ".oculta", "x" * 101):
        with pytest.raises(ValueError):
            create_folder("~", bad)


# ---- remembered project + initialisation ----------------------------------

def test_project_is_remembered_and_can_be_cleared(fake_home):
    from orchestrator.project import clear_project, get_project, set_project
    assert get_project() is None
    folder = set_project("~/Documents/app")
    assert folder == str(fake_home.resolve() / "Documents" / "app") and get_project() == folder
    clear_project()
    assert get_project() is None


def test_remembered_project_that_is_no_longer_valid_is_ignored(fake_home):
    from orchestrator.project import PROJECT_PATH, get_project
    PROJECT_PATH.write_text('{"folder": "/etc"}')
    assert get_project() is None


def test_initialize_project_creates_structure_readme_and_git_without_overwriting(fake_home):
    import shutil
    from orchestrator.project import initialize_project
    root = fake_home / "app"
    root.mkdir()
    (root / "README.md").write_text("mío")
    plan = [{"crew": "planning", "task": "roadmap"}, {"crew": "backend", "task": "api"}, {"crew": "backend", "task": "db"}]
    done = initialize_project(str(root), "Crear una tienda en línea", plan)
    assert (root / "docs").is_dir() and (root / "backend").is_dir() and not (root / "planning").exists()
    assert (root / "README.md").read_text() == "mío"            # never overwritten
    assert any("carpetas" in d for d in done)
    if shutil.which("git"):
        assert (root / ".git").is_dir() and "repositorio git" in done
    # second call is a no-op
    assert initialize_project(str(root), "otra", plan) == []


def test_initialize_project_writes_readme_with_the_approved_plan(fake_home):
    from orchestrator.project import initialize_project
    root = fake_home / "nuevo"
    root.mkdir()
    initialize_project(str(root), "Tienda en línea\nCon pagos", [{"crew": "backend", "task": "API de pagos"}])
    text = (root / "README.md").read_text()
    assert text.startswith("# Tienda en línea") and "**backend**: API de pagos" in text
