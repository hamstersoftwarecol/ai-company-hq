import asyncio
import pytest
from unittest.mock import AsyncMock

from events.ws_manager import WSManager
from orchestrator.clarify import FOLDER_QUESTION, PendingQuestions


@pytest.mark.asyncio
async def test_pending_ask_waits_for_answer_and_notifies_ui(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    manager = AsyncMock(spec=WSManager)
    reg = PendingQuestions()
    plan = [{"crew": "backend", "task": "api"}]
    task = asyncio.create_task(reg.ask("t", "inst", [FOLDER_QUESTION], manager, plan=plan))
    await asyncio.sleep(0.01)
    assert reg.list()[0]["task_id"] == "t" and reg.list()[0]["plan"] == plan
    sent = manager.broadcast_json.call_args_list[0].args[0]
    assert sent["type"] == "questions" and sent["plan"] == plan
    reg.answer("t", {"folder": "~/p"})
    answers = await task
    assert answers["folder"] == str(tmp_path.resolve() / "p")
    assert reg.list() == []
    assert manager.broadcast_json.call_args_list[-1].args[0]["type"] == "questions_resolved"


def test_answer_unknown_task_raises_key_error():
    with pytest.raises(KeyError):
        PendingQuestions().answer("nope", {})
