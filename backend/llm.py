"""
Lightweight LLM dispatcher — replaces litellm for Python 3.15 compatibility.
Dispatches to the right SDK based on model prefix.
"""

import asyncio
import json
import os
import tempfile
from typing import Any


async def acompletion(model: str, messages: list[dict[str, str]], **kwargs: Any) -> Any:
    """Call an LLM and return an object with .choices[0].message.content."""
    if os.environ.get("LLM_PROVIDER", "").strip().lower() == "claude-code":
        return await _call_claude_code(model, messages, **kwargs)
    if model.startswith("claude"):
        return await _call_anthropic(model, messages, **kwargs)
    elif model.startswith("gpt") or model.startswith("openai/"):
        return await _call_openai(model, messages, **kwargs)
    elif model.startswith("ollama/"):
        return await _call_ollama(model, messages, **kwargs)
    else:
        raise ValueError(f"Unknown model prefix: {model}")


class _Message:
    def __init__(self, content: str) -> None:
        self.content = content


class _Choice:
    def __init__(self, content: str) -> None:
        self.message = _Message(content)


class _Response:
    def __init__(self, content: str) -> None:
        self.choices = [_Choice(content)]


async def _call_anthropic(model: str, messages: list[dict], **kwargs: Any) -> _Response:
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    # Extract system message if present
    system = ""
    user_messages = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            user_messages.append(m)
    resp = await client.messages.create(
        model=model,
        max_tokens=kwargs.get("max_tokens", 4096),
        system=system or "You are a helpful assistant.",
        messages=user_messages,
    )
    return _Response(resp.content[0].text)


async def _call_openai(model: str, messages: list[dict], **kwargs: Any) -> _Response:
    from openai import AsyncOpenAI
    actual_model = model.replace("openai/", "")
    client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    resp = await client.chat.completions.create(
        model=actual_model,
        messages=messages,
        max_tokens=kwargs.get("max_tokens", 4096),
    )
    return _Response(resp.choices[0].message.content or "")


async def _call_ollama(model: str, messages: list[dict], **kwargs: Any) -> _Response:
    import aiohttp
    model_name = model.split("/", 1)[1]
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{base_url}/api/chat", json={
            "model": model_name,
            "messages": messages,
            "stream": False,
        }) as resp:
            data = await resp.json()
            return _Response(data["message"]["content"])


_CLAUDE_CODE_TIMEOUT = int(os.environ.get("CLAUDE_CODE_TIMEOUT", "600"))


async def _call_claude_code(model: str, messages: list[dict], **kwargs: Any) -> _Response:
    """Run the prompt through the local Claude Code CLI (`claude -p`).

    Uses the user's Claude login instead of an Anthropic API key, so it works
    without API credits. Enabled with LLM_PROVIDER=claude-code. Every model name
    is served by Claude: names starting with "claude" are passed through, any
    other (gpt-4o, ollama/...) falls back to CLAUDE_CODE_MODEL (default "sonnet").
    """
    system = "You are a helpful assistant."
    turns: list[str] = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            turns.append(m["content"])
    prompt = "\n\n".join(turns)

    cli_model = model if model.startswith("claude") else os.environ.get("CLAUDE_CODE_MODEL", "sonnet")
    # With a project folder the agent may read/write files there (and only there:
    # edits outside the working directory are not auto-approved). No shell access.
    cwd = kwargs.get("cwd")
    tools = "Read,Write,Edit,Glob,Grep" if cwd else ""
    cmd = [
        os.environ.get("CLAUDE_CODE_BIN", "claude"), "-p",
        "--output-format", "json",
        "--model", cli_model,
        "--system-prompt", system,
        "--tools", tools,
        *(["--permission-mode", "acceptEdits"] if cwd else []),
        "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
        "--disable-slash-commands", "--no-session-persistence",
        "--setting-sources", "",
    ]
    # The CLI must use the Claude login, never the (possibly empty) API key,
    # and must run outside the project so it does not load its .mcp.json.
    env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            cwd=cwd or tempfile.gettempdir(), env=env,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("No se encontró el comando `claude`. Instala Claude Code e inicia sesión.") from exc
    try:
        out, err = await asyncio.wait_for(proc.communicate(prompt.encode()), timeout=_CLAUDE_CODE_TIMEOUT)
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError(f"Claude Code no respondió en {_CLAUDE_CODE_TIMEOUT}s")

    text = out.decode(errors="replace").strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise RuntimeError(f"Claude Code falló: {(err.decode(errors='replace') or text)[:500]}")
    if proc.returncode != 0 or data.get("is_error"):
        raise RuntimeError(f"Claude Code falló: {str(data.get('result') or err.decode(errors='replace'))[:500]}")
    return _Response(str(data.get("result", "")))
