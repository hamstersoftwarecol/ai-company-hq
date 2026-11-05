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
