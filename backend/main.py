import asyncio
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import get_settings, save_api_keys
from events.ws_manager import ws_manager
from orchestrator.ceo_agent import process_instruction
from orchestrator.task_router import route_task
from crews.marketing_crew import MarketingCrew
from crews.frontend_crew import FrontendCrew
from crews.backend_crew import BackendCrew
from crews.mobile_crew import MobileCrew
from crews.images_crew import ImagesCrew
from crews.planning_crew import PlanningCrew

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Keys may be absent at startup; user can configure via /settings endpoint
    yield


app = FastAPI(title="AI Company HQ", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CREW_MAP: dict[str, Any] = {
    "marketing": MarketingCrew,
    "frontend": FrontendCrew,
    "backend": BackendCrew,
    "mobile": MobileCrew,
    "images": ImagesCrew,
    "planning": PlanningCrew,
}

agent_states: dict[str, dict] = {name: {"crew": name, "status": "idle", "currentTask": "", "lastOutput": "", "modelUsed": ""} for name in CREW_MAP}
task_history: list[dict] = []


class TaskRequest(BaseModel):
    instruction: str


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
    # Placeholders in .env.example / default files are not real keys
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
    task_id = str(uuid.uuid4())
    asyncio.create_task(_run_task(task_id, body.instruction))
    return {"task_id": task_id}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(ws)


async def _run_task(task_id: str, instruction: str) -> None:
    task_history.append({"task_id": task_id, "instruction": instruction, "status": "running"})
    try:
        await process_instruction(instruction, ws_manager)
        pairs = route_task(instruction)
        for crew_name, subtask in pairs:
            crew_cls = CREW_MAP.get(crew_name)
            if crew_cls:
                crew = crew_cls(ws_manager=ws_manager)
                agent_states[crew_name]["status"] = "working"
                agent_states[crew_name]["currentTask"] = subtask
                result = await crew.execute(subtask)
                agent_states[crew_name]["status"] = "complete"
                agent_states[crew_name]["lastOutput"] = result[:500]
        for entry in task_history:
            if entry["task_id"] == task_id:
                entry["status"] = "complete"
    except Exception as exc:
        import logging
        logging.exception("Task %s failed: %s", task_id, exc)
        for entry in task_history:
            if entry["task_id"] == task_id:
                entry["status"] = "error"
                entry["error"] = str(exc)
