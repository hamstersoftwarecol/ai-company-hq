import asyncio
import json
from datetime import datetime, timezone

import pytest
from unittest.mock import AsyncMock

import main
from events.ws_manager import WSManager
from events.schemas import AgentEvent
from orchestrator.clarify import Cancelled, FOLDER_QUESTION, PendingQuestions


# ---- cancel ---------------------------------------------------------------

@pytest.mark.asyncio
async def test_cancel_makes_ask_raise_cancelled_and_notifies_ui():
    manager = AsyncMock(spec=WSManager)
    reg = PendingQuestions()
    task = asyncio.create_task(reg.ask("t", "x", [FOLDER_QUESTION], manager))
    await asyncio.sleep(0.01)
    reg.cancel("t")
    with pytest.raises(Cancelled):
        await task
    assert reg.list() == []
    assert manager.broadcast_json.call_args_list[-1].args[0]["type"] == "questions_resolved"


def test_cancel_unknown_task_raises_key_error():
    with pytest.raises(KeyError):
        PendingQuestions().cancel("nope")


@pytest.mark.asyncio
async def test_cancel_endpoint_marks_task_cancelled(tmp_path, monkeypatch):
    from httpx import AsyncClient, ASGITransport
    monkeypatch.setattr(main, "HISTORY_PATH", tmp_path / "h.json")
    main.task_history.clear()
    ask_started = asyncio.Event()

    async def fake_ask(task_id, instruction, questions, ws, plan=None):
        ask_started.set()
        return await real_ask(task_id, instruction, questions, ws, plan=plan)

    real_ask = main.pending.ask
    monkeypatch.setattr(main.pending, "ask", fake_ask)
    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as client:
        task_id = (await client.post("/task", json={"instruction": "x", "crew": "backend"})).json()["task_id"]
        await asyncio.wait_for(ask_started.wait(), 2)
        await asyncio.sleep(0.05)
        assert (await client.post(f"/task/{task_id}/cancel")).status_code == 200
        await asyncio.sleep(0.05)
        assert (await client.post(f"/task/{task_id}/cancel")).status_code == 404
    assert [e["status"] for e in main.task_history if e["task_id"] == task_id] == ["cancelled"]


# ---- history persistence --------------------------------------------------

def test_history_roundtrip_and_inflight_tasks_marked_interrupted(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "HISTORY_PATH", tmp_path / "data" / "history.json")
    main.task_history.clear()
    main.task_history.extend([
        {"task_id": "a", "status": "complete", "instruction": "i"},
        {"task_id": "b", "status": "waiting", "instruction": "j"},
        {"task_id": "c", "status": "running", "instruction": "k"},
    ])
    main._save_history()
    assert [e["task_id"] for e in json.loads(main.HISTORY_PATH.read_text())] == ["a", "b", "c"]

    main.task_history.clear()
    main._load_history()
    by_id = {e["task_id"]: e for e in main.task_history}
    assert by_id["a"]["status"] == "complete"
    assert by_id["b"]["status"] == by_id["c"]["status"] == "interrupted"
    assert "reinicio" in by_id["b"]["error"]
    main.task_history.clear()


def test_load_history_ignores_missing_or_corrupt_file(tmp_path, monkeypatch):
    main.task_history.clear()
    monkeypatch.setattr(main, "HISTORY_PATH", tmp_path / "nope.json")
    main._load_history()
    (tmp_path / "bad.json").write_text("{not json")
    monkeypatch.setattr(main, "HISTORY_PATH", tmp_path / "bad.json")
    main._load_history()
    assert main.task_history == []


# ---- /agents stays in sync ------------------------------------------------

@pytest.mark.asyncio
async def test_agents_endpoint_reflects_events():
    manager = WSManager()
    manager.listeners.append(main._track_agent_state)
    try:
        await manager.broadcast(AgentEvent(
            event_id="1", agent="backend_architect", crew="backend", status="working",
            task="api", output="", model_used="m", timestamp=datetime.now(timezone.utc),
        ))
    finally:
        manager.listeners.remove(main._track_agent_state)
    backend = next(a for a in main.agent_states.values() if a["crew"] == "backend")
    assert backend["status"] == "working" and backend["currentTask"] == "api"
    main.agent_states["backend"]["status"] = "idle"


# ---- websocket origin -----------------------------------------------------

def test_websocket_rejects_foreign_origin_and_accepts_local_or_none():
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect
    client = TestClient(main.app)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/ws", headers={"origin": "https://evil.example"}):
            pass
    assert exc.value.code == 1008
    with client.websocket_connect("/ws", headers={"origin": "http://localhost:3000"}):
        pass
    with client.websocket_connect("/ws"):  # scripts / tests send no Origin
        pass
