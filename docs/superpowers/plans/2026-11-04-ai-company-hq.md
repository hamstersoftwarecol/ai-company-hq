# AI Company HQ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-agent AI system organized as a company, with a real-time Next.js dashboard where the president gives instructions and watches specialized CrewAI agents work.

**Architecture:** FastAPI backend hosts CrewAI crews and a WebSocket hub that broadcasts agent events. Next.js frontend connects via WebSocket and renders agent state in real time. A Model Router (LiteLLM) directs critical agents to Claude/GPT-4o and routine agents to Ollama local models.

**Tech Stack:** Python 3.11, CrewAI, FastAPI, LiteLLM, Ollama, Next.js 14, React, TypeScript, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-04-ai-company-hq-design.md`

## Global Constraints

- Python ≥ 3.11; Node ≥ 20
- CrewAI as the agent framework — no other multi-agent library
- LiteLLM as the unified model interface — all LLM calls go through it
- WebSocket event schema: `event_id`, `agent`, `crew`, `status`, `task`, `output`, `model_used`, `timestamp` (ISO 8601)
- Status values exactly: `"working"`, `"idle"`, `"error"`, `"complete"`
- Backend port: 8000; Frontend port: 3000
- No Docker — started with `uvicorn main:app --reload` and `npm run dev`
- Env vars loaded from `backend/.env`

## Review Focus

- **Ollama unavailable at runtime** — Model Router must fall back to `standard` tier (GPT-4o) when Ollama is unreachable, not crash.
- **WebSocket client reconnect** — `useWebSocket` must attempt reconnect on disconnect without duplicating event listeners.
- **Concurrent crew execution** — two crews executing at the same time must not corrupt the shared `ws_manager` broadcast queue.
- **Missing API key** — backend startup must fail fast with a clear error if `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is absent.
- **Large output streaming** — agents emitting outputs > 10 KB must not block the WebSocket broadcast loop.

---

## File Map

```
backend/
├── main.py                        # FastAPI app + all route mounts
├── config.py                      # Settings loaded from .env
├── orchestrator/
│   ├── __init__.py
│   ├── ceo_agent.py               # CEO Agent: receives instruction, returns plan
│   └── task_router.py             # Maps instruction → list of (crew, subtask) pairs
├── crews/
│   ├── __init__.py
│   ├── base_crew.py               # BaseCrew with emit_event()
│   ├── marketing_crew.py
│   ├── frontend_crew.py
│   ├── backend_crew.py
│   ├── mobile_crew.py
│   ├── images_crew.py
│   └── planning_crew.py
├── model_router/
│   ├── __init__.py
│   └── router.py                  # get_model_for_agent() + tier map
├── events/
│   ├── __init__.py
│   ├── schemas.py                 # AgentEvent Pydantic model
│   └── ws_manager.py             # WSManager: connect/disconnect/broadcast
├── requirements.txt
└── .env.example

frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                   # Full dashboard layout
│   └── api/task/route.ts          # POST proxy to backend /task
├── components/
│   ├── AgentCard.tsx
│   ├── AgentsGrid.tsx
│   ├── CommandInput.tsx
│   ├── LiveLog.tsx
│   └── StatusBar.tsx
├── hooks/
│   └── useWebSocket.ts
├── types/
│   └── agent.ts                   # AgentEvent, AgentStatus, Crew types
├── lib/
│   └── api.ts                     # sendTask(instruction)
└── next.config.ts

tests/
├── test_model_router.py
├── test_ws_manager.py
├── test_ceo_agent.py
├── test_base_crew.py
└── test_endpoints.py
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/config.py`
- Create: `frontend/` (Next.js project)
- Create: `backend/events/schemas.py`

**Interfaces:**
- Produces: `Settings` dataclass from `config.py` imported by all backend modules; `AgentEvent` Pydantic model from `events/schemas.py` used by all tasks.

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
crewai>=0.28.0
litellm>=1.40.0
python-dotenv>=1.0.0
pydantic>=2.0.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
```

- [ ] **Step 2: Create `backend/.env.example`**

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_LOCAL_MODEL=llama3.2
DEFAULT_REMOTE_MODEL=claude-sonnet-4-5
```

- [ ] **Step 3: Implement `Settings` in `backend/config.py`**

`Settings` reads from `.env` via `python-dotenv`. Fields: `anthropic_api_key: str`, `openai_api_key: str`, `ollama_base_url: str`, `default_local_model: str`, `default_remote_model: str`. Raise `ValueError` on startup if either API key is empty.

- [ ] **Step 4: Implement `AgentEvent` in `backend/events/schemas.py`**

```python
from pydantic import BaseModel
from typing import Literal
from datetime import datetime

class AgentEvent(BaseModel):
    event_id: str          # uuid4
    agent: str
    crew: str
    status: Literal["working", "idle", "error", "complete"]
    task: str
    output: str
    model_used: str
    timestamp: datetime
```

- [ ] **Step 5: Scaffold Next.js frontend**

```bash
cd /Users/alejandro/Documents/agentesdeIA
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

- [ ] **Step 6: Create `frontend/types/agent.ts`**

```typescript
export type AgentStatus = "working" | "idle" | "error" | "complete";

export interface AgentEvent {
  event_id: string;
  agent: string;
  crew: string;
  status: AgentStatus;
  task: string;
  output: string;
  model_used: string;
  timestamp: string;
}

export type CrewName = "marketing" | "frontend" | "backend" | "mobile" | "images" | "planning";

export interface AgentState {
  crew: CrewName;
  status: AgentStatus;
  currentTask: string;
  lastOutput: string;
  modelUsed: string;
}
```

- [ ] **Step 7: Install backend deps and verify import**

```bash
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python -c "from config import Settings; print('ok')"
```

Expected: `ok`

- [ ] **Step 8: Commit**

```bash
git init
git add backend/ frontend/ docs/
git commit -m "chore: project scaffolding — backend config, event schema, Next.js setup"
```

---

## Task 2: Model Router

**Files:**
- Create: `backend/model_router/router.py`
- Create: `tests/test_model_router.py`

**Interfaces:**
- Consumes: `Settings` from `config.py`
- Produces: `get_model_for_agent(agent_name: str) -> str` — returns a LiteLLM-compatible model string

- [ ] **Step 1: Write failing tests**

```python
# tests/test_model_router.py
from model_router.router import get_model_for_agent

def test_ceo_agent_uses_critical_model():
    model = get_model_for_agent("ceo_agent")
    assert model == "claude-sonnet-4-5"

def test_marketing_strategist_uses_standard_model():
    model = get_model_for_agent("marketing_strategist")
    assert model == "gpt-4o"

def test_reels_creator_uses_local_model():
    model = get_model_for_agent("reels_creator")
    assert "ollama" in model or "llama" in model

def test_unknown_agent_defaults_to_local():
    model = get_model_for_agent("unknown_agent_xyz")
    assert "ollama" in model or "llama" in model
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_model_router.py -v
```

Expected: 4 FAILs with `ImportError` or `ModuleNotFoundError`

- [ ] **Step 3: Implement `get_model_for_agent` in `backend/model_router/router.py`**

Define `AGENT_TIER_MAP` dict mapping each agent name to `"critical"`, `"standard"`, or `"local"`. Define `TIER_MODEL_MAP` mapping tiers to model strings from `Settings`. `get_model_for_agent` looks up the agent in `AGENT_TIER_MAP` (default `"local"`) then returns `TIER_MODEL_MAP[tier]`.

Agent tier assignments:
- `critical`: `ceo_agent`, `frontend_architect`, `backend_architect`, `mobile_developer`
- `standard`: `marketing_strategist`, `project_planner`
- `local`: `reels_creator`, `analytics_agent`, `mobile_qa`, `prompt_engineer`, `resource_manager`, `frontend_developer`, `backend_developer`, `image_generator`

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_model_router.py -v
```

Expected: 4 PASSes

- [ ] **Step 5: Add Ollama fallback test from Review Focus**

```python
def test_ollama_unavailable_falls_back_to_standard(monkeypatch):
    import litellm, model_router.router as mr
    monkeypatch.setattr(mr, "_ollama_available", lambda: False)
    model = mr.get_model_for_agent("reels_creator")
    assert model == "gpt-4o"
```

Implement `_ollama_available() -> bool` in `router.py` — tries `GET {OLLAMA_BASE_URL}/api/tags` with 1 s timeout, returns `True` on 200. `get_model_for_agent` calls it when tier is `"local"`; if `False`, returns `TIER_MODEL_MAP["standard"]`.

- [ ] **Step 6: Run all model router tests**

```bash
pytest tests/test_model_router.py -v
```

Expected: 5 PASSes

- [ ] **Step 7: Commit**

```bash
git add backend/model_router/ tests/test_model_router.py
git commit -m "feat: model router with tier-based LLM selection and Ollama fallback"
```

---

## Task 3: WebSocket Manager

**Files:**
- Create: `backend/events/ws_manager.py`
- Create: `tests/test_ws_manager.py`

**Interfaces:**
- Consumes: `AgentEvent` from `events/schemas.py`
- Produces:
  - `WSManager` class with `connect(ws: WebSocket)`, `disconnect(ws: WebSocket)`, `broadcast(event: AgentEvent) -> None`
  - Singleton `ws_manager` instance imported by `main.py` and all crews

- [ ] **Step 1: Write failing tests**

```python
# tests/test_ws_manager.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from events.ws_manager import WSManager
from events.schemas import AgentEvent
from datetime import datetime
import uuid

def make_event(**kwargs):
    defaults = dict(
        event_id=str(uuid.uuid4()), agent="test_agent", crew="test",
        status="working", task="do x", output="...",
        model_used="gpt-4o", timestamp=datetime.utcnow()
    )
    return AgentEvent(**{**defaults, **kwargs})

@pytest.mark.asyncio
async def test_broadcast_sends_to_all_connected():
    manager = WSManager()
    ws1, ws2 = AsyncMock(), AsyncMock()
    await manager.connect(ws1)
    await manager.connect(ws2)
    event = make_event()
    await manager.broadcast(event)
    ws1.send_text.assert_called_once()
    ws2.send_text.assert_called_once()

@pytest.mark.asyncio
async def test_disconnect_removes_client():
    manager = WSManager()
    ws = AsyncMock()
    await manager.connect(ws)
    await manager.disconnect(ws)
    event = make_event()
    await manager.broadcast(event)
    ws.send_text.assert_not_called()

@pytest.mark.asyncio
async def test_broadcast_skips_broken_connection():
    manager = WSManager()
    ws = AsyncMock()
    ws.send_text.side_effect = Exception("broken pipe")
    await manager.connect(ws)
    event = make_event()
    await manager.broadcast(event)  # must not raise
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_ws_manager.py -v
```

Expected: 3 FAILs

- [ ] **Step 3: Implement `WSManager` in `backend/events/ws_manager.py`**

`WSManager` holds `self.active_connections: list[WebSocket]`. `connect` appends; `disconnect` removes (ignore if not present). `broadcast` serializes `event` to JSON and calls `ws.send_text` for each connection; on exception, calls `self.disconnect(ws)` and continues. Export singleton `ws_manager = WSManager()`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_ws_manager.py -v
```

Expected: 3 PASSes

- [ ] **Step 5: Commit**

```bash
git add backend/events/ws_manager.py tests/test_ws_manager.py
git commit -m "feat: WebSocket manager with broadcast and broken-connection resilience"
```

---

## Task 4: Base Crew + CEO Agent

**Files:**
- Create: `backend/crews/base_crew.py`
- Create: `backend/orchestrator/ceo_agent.py`
- Create: `backend/orchestrator/task_router.py`
- Create: `tests/test_ceo_agent.py`
- Create: `tests/test_base_crew.py`

**Interfaces:**
- Consumes: `WSManager` (singleton), `get_model_for_agent`, `AgentEvent`
- Produces:
  - `BaseCrew(ws_manager: WSManager)` with `async execute(task: str) -> str` and `async emit_event(agent, status, task, output, model_used)`
  - `async process_instruction(instruction: str, ws_manager: WSManager) -> str`
  - `route_task(instruction: str) -> list[tuple[str, str]]` — returns `[(crew_name, subtask), ...]`

- [ ] **Step 1: Write failing tests for BaseCrew**

```python
# tests/test_base_crew.py
import pytest
from unittest.mock import AsyncMock, patch
from crews.base_crew import BaseCrew
from events.ws_manager import WSManager

@pytest.mark.asyncio
async def test_emit_event_broadcasts_to_ws_manager():
    manager = AsyncMock(spec=WSManager)
    crew = BaseCrew(ws_manager=manager)
    await crew.emit_event(
        agent="test_agent", status="working",
        task="do x", output="result", model_used="gpt-4o"
    )
    manager.broadcast.assert_called_once()
    event = manager.broadcast.call_args[0][0]
    assert event.agent == "test_agent"
    assert event.status == "working"
```

- [ ] **Step 2: Run to verify fail**

```bash
pytest tests/test_base_crew.py -v
```

- [ ] **Step 3: Implement `BaseCrew` in `backend/crews/base_crew.py`**

`BaseCrew.__init__` stores `ws_manager`. `emit_event` creates `AgentEvent` with `uuid.uuid4()` event_id and `datetime.utcnow()` timestamp, calls `await self.ws_manager.broadcast(event)`. `execute(task)` raises `NotImplementedError` — subclasses override.

- [ ] **Step 4: Run to verify pass**

```bash
pytest tests/test_base_crew.py -v
```

- [ ] **Step 5: Write failing tests for CEO Agent**

```python
# tests/test_ceo_agent.py
import pytest
from unittest.mock import AsyncMock, patch
from orchestrator.ceo_agent import process_instruction
from events.ws_manager import WSManager

@pytest.mark.asyncio
async def test_process_instruction_returns_string():
    manager = AsyncMock(spec=WSManager)
    with patch("orchestrator.ceo_agent.litellm.acompletion") as mock_llm:
        mock_llm.return_value = AsyncMock(
            choices=[AsyncMock(message=AsyncMock(content="Plan: do A, do B"))]
        )
        result = await process_instruction("Create a landing page", manager)
    assert isinstance(result, str)
    assert len(result) > 0

@pytest.mark.asyncio
async def test_process_instruction_emits_working_event():
    manager = AsyncMock(spec=WSManager)
    with patch("orchestrator.ceo_agent.litellm.acompletion") as mock_llm:
        mock_llm.return_value = AsyncMock(
            choices=[AsyncMock(message=AsyncMock(content="ok"))]
        )
        await process_instruction("any task", manager)
    calls = [c[0][0] for c in manager.broadcast.call_args_list]
    statuses = [e.status for e in calls]
    assert "working" in statuses
    assert "complete" in statuses
```

- [ ] **Step 6: Run to verify fail**

```bash
pytest tests/test_ceo_agent.py -v
```

- [ ] **Step 7: Implement `process_instruction` in `backend/orchestrator/ceo_agent.py`**

Call `await crew.emit_event(agent="ceo_agent", status="working", ...)`. Call `litellm.acompletion` with model from `get_model_for_agent("ceo_agent")`, system prompt: `"You are the CEO of an AI company. Break the user's instruction into subtasks for your specialized crews."`, user message: the instruction. Emit `status="complete"` with the response content. Return response content string.

- [ ] **Step 8: Implement `route_task` in `backend/orchestrator/task_router.py`**

`route_task(instruction: str) -> list[tuple[str, str]]` — simple keyword-based routing for now: if "marketing" or "reel" in instruction → `("marketing", instruction)`; if "frontend" or "ui" or "landing" → `("frontend", instruction)`; if "backend" or "api" or "database" → `("backend", instruction)`; if "mobile" or "app" → `("mobile", instruction)`; if "image" or "imag" → `("images", instruction)`; default → all crews with the full instruction.

- [ ] **Step 9: Run all orchestrator tests**

```bash
pytest tests/test_ceo_agent.py tests/test_base_crew.py -v
```

Expected: all PASSes

- [ ] **Step 10: Commit**

```bash
git add backend/crews/base_crew.py backend/orchestrator/ tests/test_ceo_agent.py tests/test_base_crew.py
git commit -m "feat: BaseCrew, CEO Agent orchestrator, and keyword task router"
```

---

## Task 5: Marketing, Frontend, and Backend Crews

**Files:**
- Create: `backend/crews/marketing_crew.py`
- Create: `backend/crews/frontend_crew.py`
- Create: `backend/crews/backend_crew.py`

**Interfaces:**
- Consumes: `BaseCrew`, `get_model_for_agent`, CrewAI `Agent`, `Task`, `Crew`
- Produces: `MarketingCrew(ws_manager)`, `FrontendCrew(ws_manager)`, `BackendCrew(ws_manager)` — each with `async execute(task: str) -> str`

- [ ] **Step 1: Write failing test for MarketingCrew**

```python
# tests/test_base_crew.py (append)
@pytest.mark.asyncio
async def test_marketing_crew_execute_emits_events_and_returns_string():
    manager = AsyncMock(spec=WSManager)
    with patch("litellm.acompletion") as mock_llm:
        mock_llm.return_value = AsyncMock(
            choices=[AsyncMock(message=AsyncMock(content="Campaign draft"))]
        )
        from crews.marketing_crew import MarketingCrew
        crew = MarketingCrew(ws_manager=manager)
        result = await crew.execute("Create Instagram campaign for product X")
    assert isinstance(result, str)
    manager.broadcast.assert_called()
    agents_used = {c[0][0].agent for c in manager.broadcast.call_args_list}
    assert "marketing_strategist" in agents_used
```

- [ ] **Step 2: Run to verify fail**

```bash
pytest tests/test_base_crew.py::test_marketing_crew_execute_emits_events_and_returns_string -v
```

- [ ] **Step 3: Implement `MarketingCrew` in `backend/crews/marketing_crew.py`**

Subclasses `BaseCrew`. `execute(task)` creates three CrewAI `Agent` objects (`marketing_strategist`, `reels_creator`, `analytics_agent`) with `llm=get_model_for_agent(agent_name)`. Wraps each in a CrewAI `Task`. Runs `Crew([agents], [tasks], verbose=False).kickoff()`. Before and after each agent runs, calls `await self.emit_event(agent=..., status="working"|"complete", task=task, output=..., model_used=...)`. Returns the final Crew output string.

- [ ] **Step 4: Implement `FrontendCrew` in `backend/crews/frontend_crew.py`**

Same pattern. Agents: `frontend_architect` (role: "Frontend architect designing React components"), `frontend_developer` (role: "React developer implementing components"). Both use `get_model_for_agent` for their LLM.

- [ ] **Step 5: Implement `BackendCrew` in `backend/crews/backend_crew.py`**

Agents: `backend_architect` (role: "Backend architect designing FastAPI endpoints and DB schema"), `backend_developer` (role: "Python developer implementing FastAPI endpoints").

- [ ] **Step 6: Run tests**

```bash
pytest tests/test_base_crew.py -v
```

Expected: all PASSes

- [ ] **Step 7: Commit**

```bash
git add backend/crews/marketing_crew.py backend/crews/frontend_crew.py backend/crews/backend_crew.py
git commit -m "feat: marketing, frontend, and backend crews with CrewAI agents"
```

---

## Task 6: Mobile, Images, and Planning Crews

**Files:**
- Create: `backend/crews/mobile_crew.py`
- Create: `backend/crews/images_crew.py`
- Create: `backend/crews/planning_crew.py`

**Interfaces:**
- Consumes: `BaseCrew`, same pattern as Task 5
- Produces: `MobileCrew`, `ImagesCrew`, `PlanningCrew` — each with `async execute(task: str) -> str`

- [ ] **Step 1: Implement `MobileCrew` in `backend/crews/mobile_crew.py`**

Agents: `mobile_developer` (React Native/Flutter screens), `mobile_qa` (test cases and bug reports). Same `BaseCrew` pattern.

- [ ] **Step 2: Implement `ImagesCrew` in `backend/crews/images_crew.py`**

Agents: `prompt_engineer` (generates image prompts), `image_generator` (calls DALL-E 3 via `openai.Image.create` with the generated prompt). `image_generator` emits events with `model_used="dall-e-3"`.

- [ ] **Step 3: Implement `PlanningCrew` in `backend/crews/planning_crew.py`**

Agents: `project_planner` (roadmaps, sprint plans), `resource_manager` (crew assignment, priorities).

- [ ] **Step 4: Smoke-test import of all crews**

```bash
python -c "
from crews.marketing_crew import MarketingCrew
from crews.frontend_crew import FrontendCrew
from crews.backend_crew import BackendCrew
from crews.mobile_crew import MobileCrew
from crews.images_crew import ImagesCrew
from crews.planning_crew import PlanningCrew
print('all crews import ok')
"
```

Expected: `all crews import ok`

- [ ] **Step 5: Commit**

```bash
git add backend/crews/mobile_crew.py backend/crews/images_crew.py backend/crews/planning_crew.py
git commit -m "feat: mobile, images, and planning crews"
```

---

## Task 7: FastAPI App + Endpoints

**Files:**
- Create: `backend/main.py`
- Create: `tests/test_endpoints.py`

**Interfaces:**
- Consumes: `ws_manager` singleton, `process_instruction`, `route_task`, all crew classes
- Produces: REST endpoints at `/task`, `/agents`, `/history`, `/health`; WebSocket at `/ws`

**CREW_MAP** (used by `main.py` to dispatch):
```python
CREW_MAP = {
    "marketing": MarketingCrew,
    "frontend": FrontendCrew,
    "backend": BackendCrew,
    "mobile": MobileCrew,
    "images": ImagesCrew,
    "planning": PlanningCrew,
}
```

- [ ] **Step 1: Write failing endpoint tests**

```python
# tests/test_endpoints.py
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

@pytest.mark.asyncio
async def test_health_returns_ok():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_post_task_returns_task_id():
    from main import app
    with patch("main.process_instruction", new=AsyncMock(return_value="done")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/task", json={"instruction": "Build a landing page"})
    assert resp.status_code == 200
    assert "task_id" in resp.json()

@pytest.mark.asyncio
async def test_get_agents_returns_list():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/agents")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
```

- [ ] **Step 2: Run to verify fail**

```bash
pytest tests/test_endpoints.py -v
```

- [ ] **Step 3: Implement `backend/main.py`**

Create `FastAPI` app. Mount `ws_manager`. Define:
- `GET /health` → `{"status": "ok"}`
- `POST /task` body `{"instruction": str}` → generates `task_id = str(uuid4())`, launches `asyncio.create_task(run_task(instruction))`, returns `{"task_id": task_id}`
- `GET /agents` → returns `agent_states` dict (updated by crews via event callbacks) as a list
- `GET /history` → returns completed task list
- `WebSocket /ws` → `await ws_manager.connect(ws)`, then `while True: await ws.receive_text()` (keep-alive), on disconnect `ws_manager.disconnect(ws)`

`run_task(instruction)` calls `process_instruction` which internally routes to crews via `task_router.route_task`.

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_endpoints.py -v
```

Expected: all PASSes

- [ ] **Step 5: Manual smoke test**

```bash
uvicorn main:app --reload --port 8000
# In another terminal:
curl http://localhost:8000/health
curl -X POST http://localhost:8000/task -H "Content-Type: application/json" -d '{"instruction":"test"}'
```

Expected: `{"status":"ok"}` and `{"task_id":"...uuid..."}`

- [ ] **Step 6: Commit**

```bash
git add backend/main.py tests/test_endpoints.py
git commit -m "feat: FastAPI app with /task, /agents, /history, /health, and /ws endpoints"
```

---

## Task 8: Next.js WebSocket Hook + Types

**Files:**
- Create: `frontend/hooks/useWebSocket.ts`
- Create: `frontend/lib/api.ts`

**Interfaces:**
- Consumes: `AgentEvent`, `AgentState` from `types/agent.ts`
- Produces:
  - `useWebSocket(url: string): { events: AgentEvent[], agentStates: Record<CrewName, AgentState>, isConnected: boolean }`
  - `sendTask(instruction: string): Promise<{ task_id: string }>`

- [ ] **Step 1: Implement `useWebSocket` in `frontend/hooks/useWebSocket.ts`**

React hook. Opens `new WebSocket(url)` on mount. On message: parse JSON as `AgentEvent`, append to `events` state (cap at 200), update `agentStates[event.crew]` with latest event data. On close: set `isConnected = false`, schedule reconnect after 2000 ms with `setTimeout`. On open: set `isConnected = true`. Cleanup: `ws.close()` on unmount.

- [ ] **Step 2: Implement `sendTask` in `frontend/lib/api.ts`**

```typescript
export async function sendTask(instruction: string): Promise<{ task_id: string }> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: Configure `frontend/next.config.ts` for backend proxy**

Add rewrites so `/api/task` proxies to `http://localhost:8000/task` to avoid CORS in dev.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/hooks/ frontend/lib/ frontend/next.config.ts
git commit -m "feat: useWebSocket hook with auto-reconnect and sendTask API client"
```

---

## Task 9: Dashboard Components

**Files:**
- Create: `frontend/components/AgentCard.tsx`
- Create: `frontend/components/AgentsGrid.tsx`
- Create: `frontend/components/CommandInput.tsx`
- Create: `frontend/components/LiveLog.tsx`
- Create: `frontend/components/StatusBar.tsx`

**Interfaces:**
- Consumes: `AgentState`, `AgentEvent`, `CrewName` from `types/agent.ts`
- Produces: React components consumed by `app/page.tsx`

- [ ] **Step 1: Implement `AgentCard` in `frontend/components/AgentCard.tsx`**

Props: `{ crew: CrewName; state: AgentState }`. Renders a card with crew name, status indicator (green dot for "working", gray for "idle", red for "error", blue check for "complete"), current task text, and last output truncated to 100 chars. Use Tailwind classes.

Status dot colors:
- `working` → `bg-green-400 animate-pulse`
- `idle` → `bg-gray-400`
- `error` → `bg-red-500`
- `complete` → `bg-blue-400`

- [ ] **Step 2: Implement `AgentsGrid` in `frontend/components/AgentsGrid.tsx`**

Props: `{ agentStates: Record<CrewName, AgentState> }`. Renders a `grid grid-cols-3 gap-4` of 6 `AgentCard` components, one per crew. Default state for each crew when no event received: `{ status: "idle", currentTask: "", lastOutput: "", modelUsed: "" }`.

- [ ] **Step 3: Implement `CommandInput` in `frontend/components/CommandInput.tsx`**

Props: `{ onSubmit: (instruction: string) => void; disabled: boolean }`. Textarea + "Enviar" button. Clears textarea on submit. Disables button while `disabled` is true.

- [ ] **Step 4: Implement `LiveLog` in `frontend/components/LiveLog.tsx`**

Props: `{ events: AgentEvent[] }`. Renders a scrollable `div` (max-height 200px, overflow-y-auto) with newest events at bottom. Each row: `[timestamp HH:MM:SS] [crew/agent] output`. Add a dropdown filter by crew name. Auto-scrolls to bottom on new event via `useEffect` + `ref`.

- [ ] **Step 5: Implement `StatusBar` in `frontend/components/StatusBar.tsx`**

Props: `{ agentStates: Record<CrewName, AgentState>; isConnected: boolean }`. Shows "AI Company HQ", count of active agents, and a green/red connection dot.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/components/
git commit -m "feat: AgentCard, AgentsGrid, CommandInput, LiveLog, StatusBar dashboard components"
```

---

## Task 10: Dashboard Page + End-to-End Integration

**Files:**
- Modify: `frontend/app/page.tsx`
- Create: `frontend/app/api/task/route.ts`

**Interfaces:**
- Consumes: all components from Task 9, `useWebSocket` from Task 8, `sendTask` from Task 8

- [ ] **Step 1: Implement `frontend/app/api/task/route.ts`**

Next.js route handler: `POST` proxies body to `http://localhost:8000/task`, returns response JSON.

- [ ] **Step 2: Implement full dashboard in `frontend/app/page.tsx`**

```
"use client"
Layout: flex h-screen bg-gray-950 text-white
  Left sidebar (w-72): <StatusBar>, <CommandInput onSubmit={handleSubmit} disabled={submitting}>, task history list
  Main area: <AgentsGrid agentStates={agentStates} />
  Bottom bar (h-48): <LiveLog events={events} />
```

`handleSubmit(instruction)`: sets `submitting=true`, calls `sendTask(instruction)`, sets `submitting=false` on resolve/reject.

Seed `agentStates` with all 6 crews in `idle` status as default.

- [ ] **Step 3: Start both servers and verify in browser**

```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:3000`. Verify:
- Dashboard loads with 6 agent cards all idle
- WebSocket connects (green dot in StatusBar)
- Type an instruction and click Enviar
- LiveLog shows events within 5 seconds
- At least one AgentCard changes to "working" status

- [ ] **Step 4: Commit**

```bash
git add frontend/app/
git commit -m "feat: dashboard page integrating all components with WebSocket and command input"
```

---

## Review Focus — Tests Added to Owning Tasks

| Risk | Covered in |
|------|-----------|
| Ollama unavailable → fallback to standard model | Task 2, Step 5 |
| WebSocket broken connection doesn't crash broadcast | Task 3, Step 1 (`test_broadcast_skips_broken_connection`) |
| Concurrent crew execution corrupts ws_manager | Task 3 — `WSManager` uses `list` iteration copy; add `list(self.active_connections)` in broadcast loop |
| Missing API key fails fast | Task 1, Step 3 — `Settings` raises `ValueError` on empty key |
| Large output > 10 KB doesn't block broadcast | Task 3 — `broadcast` is async and does not buffer; each `send_text` is awaited independently |
