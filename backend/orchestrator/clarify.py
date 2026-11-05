"""The one thing the agents ask the user before starting a new project: the folder (and the
plan to approve), plus the registry of tasks waiting for that answer."""
import asyncio

from events.ws_manager import WSManager
from orchestrator.project import resolve_project_dir

FOLDER_QUESTION = {
    "id": "folder",
    "kind": "folder",
    "question": "¿En qué carpeta de tu computador se desarrollará el proyecto? (se crea si no existe)",
}


class Cancelled(Exception):
    """The user cancelled the task while it was waiting for answers."""


class PendingQuestions:
    """Tasks waiting for the user's answers. The UI answers via POST /task/{id}/answers."""

    def __init__(self) -> None:
        self._items: dict[str, dict] = {}

    async def ask(
        self, task_id: str, instruction: str, questions: list[dict], ws_manager: WSManager,
        plan: list[dict] | None = None,
    ) -> dict[str, str]:
        """Wait for the user. `plan` ([{crew, task}]) is shown for approval together with the questions."""
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        self._items[task_id] = {
            "task_id": task_id, "instruction": instruction, "questions": questions,
            "plan": plan or [], "future": future,
        }
        await ws_manager.broadcast_json({
            "type": "questions", "task_id": task_id, "instruction": instruction,
            "questions": questions, "plan": plan or [],
        })
        try:
            return await future
        finally:
            self._items.pop(task_id, None)
            await ws_manager.broadcast_json({"type": "questions_resolved", "task_id": task_id})

    def answer(self, task_id: str, answers: dict[str, str]) -> dict[str, str]:
        """Validate and deliver the answers. Raises KeyError (unknown task) or ValueError (bad folder)."""
        item = self._items[task_id]
        clean = {str(k): str(v).strip() for k, v in answers.items()}
        if any(q["id"] == "folder" for q in item["questions"]):
            clean["folder"] = str(resolve_project_dir(clean.get("folder", "")))
        if not item["future"].done():
            item["future"].set_result(clean)
        return clean

    def cancel(self, task_id: str) -> None:
        """Cancel a task that is waiting for answers. Raises KeyError if it is not."""
        item = self._items[task_id]
        if not item["future"].done():
            item["future"].set_exception(Cancelled("Tarea cancelada."))

    def list(self) -> list[dict]:
        return [{k: v for k, v in item.items() if k != "future"} for item in self._items.values()]


pending = PendingQuestions()
