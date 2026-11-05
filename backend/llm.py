"""
Lightweight LLM dispatcher — replaces litellm for Python 3.15 compatibility.
Dispatches to the right SDK based on model prefix.
"""

import os
from typing import Any


async def acompletion(model: str, messages: list[dict[str, str]], **kwargs: Any) -> Any:
    """Call an LLM and return an object with .choices[0].message.content."""
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
