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
