import pytest
from unittest.mock import AsyncMock, patch

from orchestrator.ceo_agent import parse_decision, process_instruction
from events.ws_manager import WSManager


def _statuses(manager):
    return [c[0][0].status for c in manager.broadcast.call_args_list]


# ---- parsing -------------------------------------------------------------

def test_parse_plain_json_object():
    d = parse_decision('{"calls": [{"crew": "backend", "task": "api"}], "done": false, "summary": ""}')
    assert d["calls"] == [{"crew": "backend", "task": "api"}] and d["done"] is False


def test_parse_fenced_json_and_legacy_array():
    assert parse_decision('```json\n{"calls": [], "done": true, "summary": "ok"}\n```')["done"] is True
    d = parse_decision('[{"crew": "planning", "task": "plan"}]')
    assert d["calls"][0]["crew"] == "planning"


def test_parse_pseudo_tool_calls_written_as_text():
    text = (
        '<invoke name="planning">\n<parameter name="task">Plan A</parameter>\n</invoke>\n'
        '<invoke name="frontend">\n<parameter name="task">UI B</parameter>\n</invoke>'
    )
    d = parse_decision(text)
    assert [(c["crew"], c["task"]) for c in d["calls"]] == [("planning", "Plan A"), ("frontend", "UI B")]


def test_parse_garbage_returns_none():
    assert parse_decision("Plan: do A, do B") is None


# ---- autonomous loop -----------------------------------------------------

@pytest.mark.asyncio
async def test_ceo_runs_rounds_and_passes_context_between_crews():
    manager = AsyncMock(spec=WSManager)
    decisions = [
        {"calls": [{"crew": "planning", "task": "roadmap"}], "done": False, "summary": ""},
        {"calls": [{"crew": "backend", "task": "api"}, {"crew": "frontend", "task": "ui"}], "done": False, "summary": ""},
        {"calls": [], "done": True, "summary": "Todo listo"},
    ]
    dispatch = AsyncMock(side_effect=lambda crew, task, *_: f"{crew}-output")
    with patch("orchestrator.ceo_agent._decide", AsyncMock(side_effect=decisions)), \
         patch("orchestrator.ceo_agent.dispatch_to_crew", dispatch):
        result = await process_instruction("Lanzar la campaña", manager)

    sent = {c.args[0]: c.args[1] for c in dispatch.call_args_list}
    assert sent["planning"] == "roadmap"                      # first round: no context
    assert "planning-output" in sent["backend"]               # later rounds see earlier work
    assert "planning-output" in sent["frontend"]
    assert "Todo listo" in result and "backend-output" in result
    assert _statuses(manager)[0] == "working" and _statuses(manager)[-1] == "complete"


@pytest.mark.asyncio
async def test_ceo_skips_unknown_and_repeated_calls():
    manager = AsyncMock(spec=WSManager)
    decisions = [
        {"calls": [{"crew": "ghost", "task": "x"}, {"crew": "backend", "task": "api"}], "done": False, "summary": ""},
        {"calls": [{"crew": "backend", "task": "api"}], "done": False, "summary": ""},  # exact repeat
    ]
    dispatch = AsyncMock(return_value="out")
    with patch("orchestrator.ceo_agent._decide", AsyncMock(side_effect=decisions)), \
         patch("orchestrator.ceo_agent.dispatch_to_crew", dispatch):
        await process_instruction("x", manager)
    assert [c.args[0] for c in dispatch.call_args_list] == ["backend"]


@pytest.mark.asyncio
async def test_ceo_falls_back_to_planning_when_no_usable_plan():
    manager = AsyncMock(spec=WSManager)
    dispatch = AsyncMock(return_value="plan-output")
    with patch("orchestrator.ceo_agent._decide", AsyncMock(side_effect=[None, {"calls": [], "done": True, "summary": "ok"}])), \
         patch("orchestrator.ceo_agent.dispatch_to_crew", dispatch):
        await process_instruction("haz algo", manager)
    assert dispatch.call_args_list[0].args[0] == "planning"


@pytest.mark.asyncio
async def test_ceo_emits_error_when_every_crew_fails():
    manager = AsyncMock(spec=WSManager)
    decisions = [{"calls": [{"crew": "backend", "task": "api"}], "done": False, "summary": ""}]
    with patch("orchestrator.ceo_agent._decide", AsyncMock(side_effect=decisions)), \
         patch("orchestrator.ceo_agent.dispatch_to_crew", AsyncMock(side_effect=RuntimeError("boom"))):
        with pytest.raises(RuntimeError, match="boom"):
            await process_instruction("x", manager)
    assert _statuses(manager)[-1] == "error"


@pytest.fixture
def fake_home(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    return tmp_path


@pytest.mark.asyncio
async def test_new_project_shows_plan_asks_folder_once_then_runs_the_plan(fake_home):
    from orchestrator.project import get_project
    manager = AsyncMock(spec=WSManager)
    asked = {}

    async def ask(questions, plan):
        asked["questions"], asked["plan"] = questions, plan
        return {"folder": "~/proyecto"}

    decisions = [
        {"calls": [{"crew": "backend", "task": "api"}, {"crew": "frontend", "task": "ui"}], "done": False, "summary": ""},
        {"calls": [], "done": True, "summary": "ok"},
    ]
    decide = AsyncMock(side_effect=decisions)
    dispatch = AsyncMock(return_value="out")
    with patch("orchestrator.ceo_agent._decide", decide), patch("orchestrator.ceo_agent.dispatch_to_crew", dispatch):
        await process_instruction("Crear una app", manager, ask=ask)

    folder = str(fake_home.resolve() / "proyecto")
    assert [q["id"] for q in asked["questions"]] == ["folder"]                    # only the folder is asked
    assert [(p["crew"], p["task"]) for p in asked["plan"]] == [("backend", "api"), ("frontend", "ui")]
    assert get_project() == folder                                                # remembered
    assert (fake_home / "proyecto" / "backend").is_dir() and (fake_home / "proyecto" / "README.md").exists()
    assert {c.args[0] for c in dispatch.call_args_list} == {"backend", "frontend"}  # the approved plan ran
    assert all(c.args[2] == folder for c in dispatch.call_args_list)
    assert decide.call_count == 2          # round 1 reused the plan the user approved (no extra CEO call)
    assert _statuses(manager)[-1] == "complete"


@pytest.mark.asyncio
async def test_next_task_in_the_same_project_does_not_ask_anything(fake_home):
    from orchestrator.project import set_project
    folder = set_project("~/proyecto")
    manager = AsyncMock(spec=WSManager)
    ask = AsyncMock()
    dispatch = AsyncMock(return_value="out")
    decisions = [{"calls": [{"crew": "backend", "task": "api"}], "done": False, "summary": ""},
                 {"calls": [], "done": True, "summary": "ok"}]
    with patch("orchestrator.ceo_agent._decide", AsyncMock(side_effect=decisions)), \
         patch("orchestrator.ceo_agent.dispatch_to_crew", dispatch):
        await process_instruction("Otra tarea", manager, ask=ask)
    ask.assert_not_awaited()
    assert dispatch.call_args_list[0].args[2] == folder


@pytest.mark.asyncio
async def test_cancelling_the_approval_returns_the_ceo_to_idle(fake_home):
    from orchestrator.clarify import Cancelled
    manager = AsyncMock(spec=WSManager)

    async def ask(questions, plan):
        raise Cancelled("x")

    decision = {"calls": [{"crew": "backend", "task": "api"}], "done": False, "summary": ""}
    with patch("orchestrator.ceo_agent._decide", AsyncMock(return_value=decision)):
        with pytest.raises(Cancelled):
            await process_instruction("x", manager, ask=ask)
    assert _statuses(manager)[-1] == "idle"


@pytest.mark.asyncio
async def test_ceo_can_dispatch_to_an_agent_created_by_the_user(fake_home):
    from orchestrator.agents_registry import add_agent
    add_agent("Legal", "Revisas contratos y términos de uso.", "#112233")
    manager = AsyncMock(spec=WSManager)
    dispatch = AsyncMock(return_value="out")
    decisions = [{"calls": [{"crew": "legal", "task": "revisar T&C"}], "done": False, "summary": ""},
                 {"calls": [], "done": True, "summary": "ok"}]
    with patch("orchestrator.ceo_agent._decide", AsyncMock(side_effect=decisions)), \
         patch("orchestrator.ceo_agent.dispatch_to_crew", dispatch):
        await process_instruction("Revisar", manager, project_dir=str(fake_home))
    assert dispatch.call_args_list[0].args[0] == "legal"
