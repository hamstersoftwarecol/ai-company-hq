import asyncio
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
    with patch("main.process_instruction", new=AsyncMock(return_value="done")):
        from main import app
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/task", json={"instruction": "Build a landing page"})
    assert resp.status_code == 200
    assert "task_id" in resp.json()


@pytest.mark.asyncio
async def test_post_task_with_crew_dispatches_directly():
    from httpx import AsyncClient, ASGITransport
    with patch("main.dispatch_to_crew", new=AsyncMock(return_value="done")) as dispatch, \
         patch("main.pending.ask", new=AsyncMock(return_value={"folder": "/home/x/proj"})):
        from main import app
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/task", json={"instruction": "Diseña la API", "crew": "backend"})
        await asyncio.sleep(0.05)
    assert resp.status_code == 200
    dispatch.assert_awaited_once_with("backend", "Diseña la API", "/home/x/proj")


@pytest.mark.asyncio
async def test_post_task_unknown_crew_returns_400():
    from httpx import AsyncClient, ASGITransport
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/task", json={"instruction": "x", "crew": "nope"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_agents_returns_list():
    from httpx import AsyncClient, ASGITransport
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/agents")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_answers_for_unknown_task_returns_404():
    from httpx import AsyncClient, ASGITransport
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/task/nope/answers", json={"answers": {"folder": "~/x"}})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_answers_with_invalid_folder_returns_400_and_valid_one_resolves(tmp_path, monkeypatch):
    import asyncio
    from httpx import AsyncClient, ASGITransport
    from main import app
    from orchestrator.clarify import pending, FOLDER_QUESTION

    monkeypatch.setenv("HOME", str(tmp_path))
    fut = asyncio.get_running_loop().create_future()
    pending._items["t1"] = {"task_id": "t1", "instruction": "x", "questions": [FOLDER_QUESTION], "future": fut}
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            bad = await client.post("/task/t1/answers", json={"answers": {"folder": "/etc"}})
            assert bad.status_code == 400 and not fut.done()
            listed = await client.get("/pending")
            assert [p["task_id"] for p in listed.json()] == ["t1"] and "future" not in listed.json()[0]
            ok = await client.post("/task/t1/answers", json={"answers": {"folder": "~/mi-proyecto"}})
        assert ok.status_code == 200
        assert (await fut)["folder"] == str(tmp_path.resolve() / "mi-proyecto")
        assert (tmp_path / "mi-proyecto").is_dir()
    finally:
        pending._items.pop("t1", None)


@pytest.mark.asyncio
async def test_folders_endpoints_list_and_create(tmp_path, monkeypatch):
    from httpx import AsyncClient, ASGITransport
    from main import app
    monkeypatch.setenv("HOME", str(tmp_path))
    (tmp_path / "Documents").mkdir()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        listed = (await client.get("/folders")).json()
        assert [f["name"] for f in listed["folders"]] == ["Documents"]
        created = await client.post("/folders", json={"parent": str(tmp_path / "Documents"), "name": "nuevo"})
        assert created.status_code == 200 and (tmp_path / "Documents" / "nuevo").is_dir()
        assert (await client.get("/folders", params={"path": "/etc"})).status_code == 400
        assert (await client.post("/folders", json={"parent": "~", "name": "a/b"})).status_code == 400
