import os
import pytest
from unittest.mock import patch, AsyncMock


@pytest.fixture(autouse=True)
def mock_api_keys(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-ant")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-oai")


@pytest.mark.asyncio
async def test_health_returns_ok():
    from httpx import AsyncClient, ASGITransport
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_post_task_returns_task_id():
    from httpx import AsyncClient, ASGITransport
    with patch("main.process_instruction", new=AsyncMock(return_value="done")), \
         patch("main.route_task", return_value=[]):
        from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/task", json={"instruction": "Build a landing page"})
    assert resp.status_code == 200
    assert "task_id" in resp.json()


@pytest.mark.asyncio
async def test_get_agents_returns_list():
    from httpx import AsyncClient, ASGITransport
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/agents")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
