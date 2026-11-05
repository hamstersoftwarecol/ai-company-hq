import os
import tempfile

# Must be set before any test imports `main`, so tests never touch the real history file.
_tmp = tempfile.mkdtemp(prefix="hq-tests-")
os.environ["HISTORY_FILE"] = os.path.join(_tmp, "history.json")
os.environ["AGENTS_FILE"] = os.path.join(_tmp, "agents.json")
os.environ["PROJECT_FILE"] = os.path.join(_tmp, "project.json")


import pytest


@pytest.fixture(autouse=True)
def clean_state():
    """Every test starts without a remembered project, custom agents or history."""
    for var in ("HISTORY_FILE", "AGENTS_FILE", "PROJECT_FILE"):
        if os.path.exists(os.environ[var]):
            os.unlink(os.environ[var])
    yield
