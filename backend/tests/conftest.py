import os
import tempfile

# Must be set before any test imports `main`, so tests never touch the real history file.
os.environ["HISTORY_FILE"] = os.path.join(tempfile.mkdtemp(prefix="hq-tests-"), "history.json")
