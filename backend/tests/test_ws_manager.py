import pytest
from unittest.mock import AsyncMock
from events.ws_manager import WSManager
from events.schemas import AgentEvent
from datetime import datetime, timezone
import uuid


def make_event(**kwargs):
    defaults = dict(
        event_id=str(uuid.uuid4()), agent="test_agent", crew="test",
        status="working", task="do x", output="...",
        model_used="gpt-4o", timestamp=datetime.now(timezone.utc)
    )
    return AgentEvent(**{**defaults, **kwargs})


@pytest.mark.asyncio
async def test_broadcast_sends_to_all_connected():
    manager = WSManager()
    ws1, ws2 = AsyncMock(), AsyncMock()
    await manager.connect(ws1)
    await manager.connect(ws2)
    await manager.broadcast(make_event())
    ws1.send_text.assert_called_once()
    ws2.send_text.assert_called_once()


@pytest.mark.asyncio
async def test_disconnect_removes_client():
    manager = WSManager()
    ws = AsyncMock()
    await manager.connect(ws)
    await manager.disconnect(ws)
    await manager.broadcast(make_event())
    ws.send_text.assert_not_called()


@pytest.mark.asyncio
async def test_broadcast_skips_broken_connection():
    manager = WSManager()
    ws = AsyncMock()
    ws.send_text.side_effect = Exception("broken pipe")
    await manager.connect(ws)
    await manager.broadcast(make_event())  # must not raise
