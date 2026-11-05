import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from crews.base_crew import BaseCrew
from events.ws_manager import WSManager


@pytest.mark.asyncio
async def test_emit_event_broadcasts_to_ws_manager():
    manager = AsyncMock(spec=WSManager)
    crew = BaseCrew(ws_manager=manager)
    crew.crew_name = "test"
    await crew.emit_event(
        agent="test_agent", status="working",
        task="do x", output="result", model_used="gpt-4o"
    )
    manager.broadcast.assert_called_once()
    event = manager.broadcast.call_args[0][0]
    assert event.agent == "test_agent"
    assert event.status == "working"


@pytest.mark.asyncio
async def test_marketing_crew_execute_emits_events_and_returns_string():
    manager = AsyncMock(spec=WSManager)
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="Campaign draft"))]
    with patch("llm.acompletion", return_value=mock_response):
        from crews.marketing_crew import MarketingCrew
        crew = MarketingCrew(ws_manager=manager)
        result = await crew.execute("Create Instagram campaign for product X")
    assert isinstance(result, str)
    manager.broadcast.assert_called()
    agents_used = {c[0][0].agent for c in manager.broadcast.call_args_list}
    assert "marketing_strategist" in agents_used
