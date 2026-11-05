import pytest
import model_router.router as mr
from model_router.router import get_model_for_agent


def test_ceo_agent_uses_critical_model(monkeypatch):
    monkeypatch.setattr(mr, "_ollama_available", lambda: True)
    model = get_model_for_agent("ceo_agent")
    assert "claude" in model


def test_marketing_strategist_uses_standard_model(monkeypatch):
    monkeypatch.setattr(mr, "_ollama_available", lambda: True)
    model = get_model_for_agent("marketing_strategist")
    assert model == "gpt-4o"


def test_reels_creator_uses_local_model(monkeypatch):
    monkeypatch.setattr(mr, "_ollama_available", lambda: True)
    model = get_model_for_agent("reels_creator")
    assert "ollama" in model or "llama" in model


def test_unknown_agent_defaults_to_local(monkeypatch):
    monkeypatch.setattr(mr, "_ollama_available", lambda: True)
    model = get_model_for_agent("unknown_agent_xyz")
    assert "ollama" in model or "llama" in model


def test_ollama_unavailable_falls_back_to_standard(monkeypatch):
    monkeypatch.setattr(mr, "_ollama_available", lambda: False)
    model = get_model_for_agent("reels_creator")
    assert model == "gpt-4o"
