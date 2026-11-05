import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from orchestrator.ceo_agent import process_instruction
from events.ws_manager import WSManager


@pytest.mark.asyncio
async def test_process_instruction_returns_string():
    manager = AsyncMock(spec=WSManager)
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="Plan: do A, do B"))]
    with patch("orchestrator.ceo_agent.llm.acompletion", return_value=mock_response):
        result = await process_instruction("Create a landing page", manager)
    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_process_instruction_emits_working_and_complete():
    manager = AsyncMock(spec=WSManager)
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="ok"))]
    with patch("orchestrator.ceo_agent.llm.acompletion", return_value=mock_response):
        await process_instruction("any task", manager)
    calls = [c[0][0] for c in manager.broadcast.call_args_list]
    statuses = [e.status for e in calls]
    assert "working" in statuses
    assert "complete" in statuses
