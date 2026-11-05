import json
import pytest
from unittest.mock import patch

import llm


class _FakeProc:
    def __init__(self, stdout: bytes, returncode: int = 0, stderr: bytes = b""):
        self._out, self._err, self.returncode = stdout, stderr, returncode
        self.received = b""

    async def communicate(self, data=None):
        self.received = data or b""
        return self._out, self._err


@pytest.mark.asyncio
async def test_claude_code_provider_runs_cli_without_api_key(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "claude-code")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-should-not-leak")
    proc = _FakeProc(json.dumps({"result": "hola", "is_error": False}).encode())
    captured = {}

    async def fake_exec(*cmd, **kw):
        captured["cmd"], captured["env"] = cmd, kw["env"]
        return proc

    with patch("asyncio.create_subprocess_exec", fake_exec):
        resp = await llm.acompletion("gpt-4o", [
            {"role": "system", "content": "Eres breve"},
            {"role": "user", "content": "di hola"},
        ])
    assert resp.choices[0].message.content == "hola"
    assert "ANTHROPIC_API_KEY" not in captured["env"]
    assert captured["cmd"][captured["cmd"].index("--model") + 1] == "sonnet"  # non-claude -> default
    assert proc.received == b"di hola"


@pytest.mark.asyncio
async def test_claude_code_provider_raises_on_cli_error(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "claude-code")
    proc = _FakeProc(json.dumps({"result": "Not logged in", "is_error": True}).encode(), returncode=1)

    async def fake_exec(*cmd, **kw):
        return proc

    with patch("asyncio.create_subprocess_exec", fake_exec):
        with pytest.raises(RuntimeError, match="Not logged in"):
            await llm.acompletion("claude-sonnet-5-5", [{"role": "user", "content": "x"}])
