import pytest
from orchestrator.agents_registry import (
    MAX_CUSTOM_AGENTS, add_agent, crew_names, delete_agent, get_agent, list_agents,
)


def test_add_list_get_and_delete():
    a = add_agent("Legal", "Revisas contratos y términos.", "#112233")
    assert a["key"] == "legal" and list_agents() == [a] and get_agent("legal") == a
    assert crew_names()[-1] == "legal"
    delete_agent("legal")
    assert list_agents() == [] and get_agent("legal") is None


def test_key_is_a_slug_unique_and_never_a_built_in_name():
    assert add_agent("Diseño Ñandú", "Diseñas cosas bonitas.", "#112233")["key"] == "diseno-nandu"
    assert add_agent("Backend", "Hago backend propio.", "#112233")["key"] == "backend-2"
    assert add_agent("Backend", "Otro más.", "#112233")["key"] == "backend-3"
    assert add_agent("!!!", "Nombre solo con símbolos.", "#112233")["key"] == "agente"


@pytest.mark.parametrize("label,role,color", [
    ("", "Hace algo útil.", "#112233"),
    ("x" * 21, "Hace algo útil.", "#112233"),
    ("Ok", "cort", "#112233"),
    ("Ok", "Hace algo útil.", "rojo"),
    ("Ok", "Hace algo útil.", "#12345"),
])
def test_rejects_invalid_input(label, role, color):
    with pytest.raises(ValueError):
        add_agent(label, role, color)


def test_limit_of_custom_agents():
    for i in range(MAX_CUSTOM_AGENTS):
        add_agent(f"Agente {i}", "Hace algo útil.", "#112233")
    with pytest.raises(ValueError, match="sitio"):
        add_agent("Uno más", "Hace algo útil.", "#112233")


def test_delete_unknown_raises_key_error():
    with pytest.raises(KeyError):
        delete_agent("nadie")


def test_custom_agents_use_the_strong_model():
    from model_router.router import get_model_for_agent
    assert get_model_for_agent("custom_legal") == "claude-sonnet-5-5"
