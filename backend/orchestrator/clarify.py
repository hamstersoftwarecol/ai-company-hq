"""Questions the agents ask the user before starting, and the registry of pending ones."""
import asyncio
import json

import llm
from events.ws_manager import WSManager
from orchestrator.project import resolve_project_dir

FOLDER_QUESTION = {
    "id": "folder",
    "kind": "folder",
    "question": "¿En qué carpeta de tu computador se desarrollará el proyecto? (se crea si no existe)",
}

_CLARIFY_SYSTEM = """You are the CEO of an AI company about to start a project with your crews.
Before starting, decide which clarifying questions you must ask the user. Ask only what is
essential and not already stated in the instruction (goal, target audience, stack or
technology, scope, deadline, constraints...). Maximum 3 questions. Do NOT ask about the
folder, it is asked separately. If the instruction is already specific enough, ask nothing.
Write the questions in the same language as the instruction.
Reply with ONLY a JSON object: {"questions": [{"question": "<text>"}]}"""


async def clarifying_questions(model: str, instruction: str) -> list[dict]:
    """Ask the CEO model which questions it needs answered. Never raises: [] on any problem."""
    try:
        response = await llm.acompletion(
            model=model,
            messages=[
                {"role": "system", "content": _CLARIFY_SYSTEM},
                {"role": "user", "content": instruction},
            ],
        )
        text = (response.choices[0].message.content or "").strip()
        start, end = text.find("{"), text.rfind("}")
        data = json.loads(text[start : end + 1])
        items = data.get("questions", [])
    except Exception:
        return []
    questions = []
    for item in items[:3]:
        q = str(item.get("question", "")).strip() if isinstance(item, dict) else str(item).strip()
        if q:
            questions.append({"id": f"q{len(questions) + 1}", "kind": "text", "question": q})
    return questions


class PendingQuestions:
    """Tasks waiting for the user's answers. The UI answers via POST /task/{id}/answers."""

    def __init__(self) -> None:
        self._items: dict[str, dict] = {}

    async def ask(self, task_id: str, instruction: str, questions: list[dict], ws_manager: WSManager) -> dict[str, str]:
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        self._items[task_id] = {
            "task_id": task_id, "instruction": instruction, "questions": questions, "future": future,
        }
        await ws_manager.broadcast_json(
            {"type": "questions", "task_id": task_id, "instruction": instruction, "questions": questions}
        )
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

    def list(self) -> list[dict]:
        return [{k: v for k, v in item.items() if k != "future"} for item in self._items.values()]


pending = PendingQuestions()


def format_answers(questions: list[dict], answers: dict[str, str]) -> str:
    """Render the user's answers (except the folder) as text for the crews."""
    lines = [
        f"- {q['question']} → {answers.get(q['id']) or '(sin respuesta)'}"
        for q in questions if q["id"] != "folder"
    ]
    return "\n".join(lines)
