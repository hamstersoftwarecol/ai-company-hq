import asyncio
import json
import logging
import os
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import save_api_keys
from events.ws_manager import ws_manager
from orchestrator.ceo_agent import dispatch_to_crew, process_instruction
from orchestrator.clarify import FOLDER_QUESTION, Cancelled, pending
from orchestrator.agents_registry import add_agent, crew_names, delete_agent, list_agents
from orchestrator.project import (
    clear_project, create_folder, get_project, initialize_project, list_folders, set_project,
)
from mcp_servers.crew_server import get_server, set_ws_manager

CREW_NAMES = ["marketing", "frontend", "backend", "mobile", "images", "planning"]  # built-in crews


ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]

# Where finished/running tasks are remembered across backend restarts (not committed to git)
HISTORY_PATH = Path(os.getenv("HISTORY_FILE", Path(__file__).parent / "data" / "history.json"))
HISTORY_LIMIT = 200


def _save_history() -> None:
    try:
        HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = Path(tempfile.mktemp(dir=HISTORY_PATH.parent, suffix=".tmp"))
        tmp.write_text(json.dumps(task_history[-HISTORY_LIMIT:], ensure_ascii=False, indent=1))
        tmp.replace(HISTORY_PATH)  # atomic: a crash never leaves a half-written file
    except OSError:
        logging.exception("Could not save the task history")


def _load_history() -> None:
    """Restore the history. Tasks that were in flight died with the old process."""
    try:
        items = json.loads(HISTORY_PATH.read_text())
    except (OSError, ValueError):
        return
    for entry in items if isinstance(items, list) else []:
        if entry.get("status") in ("waiting", "running"):
            entry["status"] = "interrupted"
            entry["error"] = "Interrumpida por un reinicio del backend."
        task_history.append(entry)


def _update_task(task_id: str, **fields) -> None:
    for entry in task_history:
        if entry["task_id"] == task_id:
            entry.update(fields)
    _save_history()


def _track_agent_state(event) -> None:
    """Keep GET /agents in sync with the events the agents emit."""
    if event.crew in agent_states or event.crew in crew_names():
        agent_states[event.crew] = {
            "crew": event.crew, "status": event.status, "currentTask": event.task,
            "lastOutput": event.output, "modelUsed": event.model_used,
        }


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Wire ws_manager into MCP crew server so crew tools can broadcast events
    set_ws_manager(ws_manager)
    ws_manager.listeners.append(_track_agent_state)
    get_server()  # pre-build the MCP server
    _load_history()
    yield
    ws_manager.listeners.remove(_track_agent_state)


app = FastAPI(title="AI Company HQ", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent_states: dict[str, dict] = {
    name: {"crew": name, "status": "idle", "currentTask": "", "lastOutput": "", "modelUsed": ""}
    for name in CREW_NAMES
}
task_history: list[dict] = []
_background_tasks: set[asyncio.Task] = set()


class TaskRequest(BaseModel):
    instruction: str
    crew: str | None = None


class NewAgentRequest(BaseModel):
    label: str
    role: str
    color: str


class ProjectRequest(BaseModel):
    folder: str


class NewFolderRequest(BaseModel):
    parent: str
    name: str


class AnswersRequest(BaseModel):
    answers: dict[str, str]


class SettingsRequest(BaseModel):
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/settings")
async def get_settings_status() -> dict:
    import os
    ant = os.getenv("ANTHROPIC_API_KEY", "")
    oai = os.getenv("OPENAI_API_KEY", "")
    _PLACEHOLDERS = {"", "sk-ant-...", "sk-...", "your-key-here"}
    ant_ok = bool(ant and ant not in _PLACEHOLDERS and len(ant) > 20)
    oai_ok = bool(oai and oai not in _PLACEHOLDERS and len(oai) > 20)
    return {
        "anthropic_configured": ant_ok,
        "openai_configured": oai_ok,
        "anthropic_key_hint": f"{ant[:10]}..." if ant_ok else "",
        "openai_key_hint": f"{oai[:8]}..." if oai_ok else "",
    }


@app.post("/settings")
async def update_settings(body: SettingsRequest) -> dict:
    save_api_keys(body.anthropic_api_key, body.openai_api_key)
    return {"status": "saved"}


@app.get("/agents")
async def get_agents() -> list:
    return list(agent_states.values())


@app.get("/history")
async def get_history() -> list:
    return task_history


@app.post("/task")
async def post_task(body: TaskRequest) -> dict:
    if body.crew is not None and body.crew not in crew_names():
        raise HTTPException(status_code=400, detail=f"Unknown crew: {body.crew}")
    task_id = str(uuid.uuid4())
    # keep a reference: a bare asyncio.create_task() can be garbage-collected mid-run
    task = asyncio.create_task(_run_task(task_id, body.instruction, body.crew))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return {"task_id": task_id}


@app.get("/custom-agents")
async def get_custom_agents() -> list:
    return list_agents()


@app.post("/custom-agents")
async def post_custom_agent(body: NewAgentRequest) -> dict:
    try:
        return add_agent(body.label, body.role, body.color)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.delete("/custom-agents/{key}")
async def delete_custom_agent(key: str) -> dict:
    try:
        delete_agent(key)
    except KeyError:
        raise HTTPException(status_code=404, detail="Ese agente no existe.")
    agent_states.pop(key, None)
    return {"status": "deleted"}


@app.get("/project")
async def get_current_project() -> dict:
    """The project folder every task is developed in (asked once, then remembered)."""
    return {"folder": get_project()}


@app.post("/project")
async def post_project(body: ProjectRequest) -> dict:
    """Choose (or change) the project folder without waiting for a task."""
    try:
        return {"folder": set_project(body.folder)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.delete("/project")
async def delete_project() -> dict:
    """Forget the current project: the next task starts a new one (plan + folder)."""
    clear_project()
    return {"folder": None}


@app.get("/folders")
async def get_folders(path: str | None = None) -> dict:
    """Sub-folders of `path` (default ~) for the folder picker."""
    try:
        return list_folders(path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/folders")
async def post_folder(body: NewFolderRequest) -> dict:
    """Create a new folder inside `parent` from the folder picker."""
    try:
        return {"path": str(create_folder(body.parent, body.name))}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/pending")
async def get_pending() -> list:
    """Tasks that are waiting for the user to answer the agents' questions."""
    return pending.list()


@app.post("/task/{task_id}/answers")
async def post_answers(task_id: str, body: AnswersRequest) -> dict:
    try:
        answers = pending.answer(task_id, body.answers)
    except KeyError:
        raise HTTPException(status_code=404, detail="Esa tarea no está esperando respuestas.")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    _update_task(task_id, status="running", folder=answers.get("folder"))
    return {"status": "ok", "folder": answers.get("folder")}


@app.post("/task/{task_id}/cancel")
async def post_cancel(task_id: str) -> dict:
    """Cancel a task that is still waiting for the user's answers."""
    try:
        pending.cancel(task_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Esa tarea no está esperando respuestas.")
    return {"status": "cancelled"}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    # Browsers do not apply CORS to WebSockets, so check the Origin ourselves:
    # otherwise any web page the user visits could read the agents' tasks and output.
    # Non-browser clients (scripts, tests) send no Origin and are allowed.
    origin = ws.headers.get("origin")
    if origin is not None and origin not in ALLOWED_ORIGINS:
        await ws.close(code=1008)
        return
    await ws.accept()
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(ws)


async def _run_task(task_id: str, instruction: str, crew: str | None = None) -> None:
    folder = get_project()
    task_history.append({
        "task_id": task_id, "instruction": instruction, "crew": crew,
        # with a remembered project nothing is asked: it starts right away
        "status": "running" if folder else "waiting", "folder": folder,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _save_history()
    try:
        if crew:
            if folder is None:
                # Direct assignment to a new project: approve the plan and choose the folder once
                plan = [{"crew": crew, "task": instruction}]
                answers = await pending.ask(task_id, instruction, [FOLDER_QUESTION], ws_manager, plan=plan)
                folder = set_project(answers["folder"])
                initialize_project(folder, instruction, plan)
            result = await dispatch_to_crew(crew, instruction, folder)
        else:
            # The CEO plans, asks the folder once (new project) and dispatches crews via MCP tools
            async def ask(questions: list[dict], plan: list[dict]) -> dict[str, str]:
                return await pending.ask(task_id, instruction, questions, ws_manager, plan=plan)

            result = await process_instruction(instruction, ws_manager, ask=ask)
        _update_task(task_id, status="complete", result=result[:500])
    except Cancelled:
        _update_task(task_id, status="cancelled")
    except Exception as exc:
        logging.exception("Task %s failed: %s", task_id, exc)
        _update_task(task_id, status="error", error=str(exc))
