import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from events.ws_manager import WSManager
from orchestrator.clarify import FOLDER_QUESTION, PendingQuestions, clarifying_questions, format_answers


def _resp(text):
    return MagicMock(choices=[MagicMock(message=MagicMock(content=text))])


@pytest.mark.asyncio
async def test_clarifying_questions_parses_and_limits_to_three():
    text = '{"questions": [{"question": "A?"}, {"question": "B?"}, {"question": "C?"}, {"question": "D?"}]}'
    with patch("orchestrator.clarify.llm.acompletion", AsyncMock(return_value=_resp(text))):
        qs = await clarifying_questions("m", "haz una app")
    assert [q["id"] for q in qs] == ["q1", "q2", "q3"] and qs[0]["question"] == "A?"


@pytest.mark.asyncio
async def test_clarifying_questions_returns_empty_on_garbage_or_error():
    with patch("orchestrator.clarify.llm.acompletion", AsyncMock(return_value=_resp("no json"))):
        assert await clarifying_questions("m", "x") == []
    with patch("orchestrator.clarify.llm.acompletion", AsyncMock(side_effect=RuntimeError("boom"))):
        assert await clarifying_questions("m", "x") == []


@pytest.mark.asyncio
async def test_pending_ask_waits_for_answer_and_notifies_ui(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    manager = AsyncMock(spec=WSManager)
    reg = PendingQuestions()
    task = asyncio.create_task(reg.ask("t", "inst", [FOLDER_QUESTION], manager))
    await asyncio.sleep(0.01)
    assert reg.list()[0]["task_id"] == "t"
    assert manager.broadcast_json.call_args_list[0].args[0]["type"] == "questions"
    reg.answer("t", {"folder": "~/p"})
    answers = await task
    assert answers["folder"] == str(tmp_path.resolve() / "p")
    assert reg.list() == []
    assert manager.broadcast_json.call_args_list[-1].args[0]["type"] == "questions_resolved"


def test_answer_unknown_task_raises_key_error():
    with pytest.raises(KeyError):
        PendingQuestions().answer("nope", {})


def test_format_answers_skips_folder_and_marks_blank():
    qs = [{"id": "q1", "question": "¿Público?"}, {"id": "q2", "question": "¿Plazo?"}, FOLDER_QUESTION]
    out = format_answers(qs, {"q1": "B2B", "folder": "/x"})
    assert "¿Público? → B2B" in out and "¿Plazo? → (sin respuesta)" in out and "folder" not in out
