"""
CEO agent — orchestrates all crews via MCP tools.

Flow:
1. Claude (CEO) receives the instruction and decides which crews to call
2. It uses the FastMCP in-process client to call crew tools
3. Each crew tool call goes through the MCP protocol and returns the output
"""
import json
import llm
from fastmcp import Client
from events.ws_manager import WSManager
from crews.base_crew import BaseCrew
from model_router.router import get_model_for_agent
from mcp_servers.crew_server import get_server

CREW_NAMES = ["marketing", "frontend", "backend", "mobile", "images", "planning"]

_CEO_SYSTEM = """You are the CEO of an AI company. You have access to these MCP tools — one per crew:
- marketing: strategy, reels, analytics
- frontend: UI/UX, React
- backend: API, database, infra
- mobile: iOS and Android
- images: graphic design and image generation
- planning: project management and roadmap

When you receive an instruction, decide which crews are needed and call their MCP tools with a focused subtask.
Return a JSON array of objects: [{"crew": "<name>", "task": "<focused subtask>"}]
Only include the crews that are truly relevant to the instruction.
"""


async def process_instruction(instruction: str, ws_manager: WSManager) -> str:
    base = BaseCrew(ws_manager=ws_manager)
    base.crew_name = "orchestrator"
    model = get_model_for_agent("ceo_agent")

    await base.emit_event(
        agent="ceo_agent", status="working",
        task=instruction, output="", model_used=model,
    )

    # Step 1: CEO decides which crews to involve
    response = await llm.acompletion(
        model=model,
        messages=[
            {"role": "system", "content": _CEO_SYSTEM},
            {"role": "user", "content": instruction},
        ],
    )
    plan_text = response.choices[0].message.content or "[]"

    # Parse JSON plan
    try:
        # Strip markdown fences if present
        clean = plan_text.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        pairs: list[dict] = json.loads(clean.strip())
    except Exception:
        # Fallback: route everything if parsing fails
        pairs = [{"crew": "planning", "task": instruction}]

    await base.emit_event(
        agent="ceo_agent", status="complete",
        task=instruction, output=plan_text, model_used=model,
    )

    # Step 2: Dispatch to crews via MCP
    server = get_server()
    results: list[str] = []
    async with Client(server) as client:
        for item in pairs:
            crew_name = item.get("crew", "")
            subtask   = item.get("task", instruction)
            if crew_name not in CREW_NAMES:
                continue
            tool_result = await client.call_tool(crew_name, {"task": subtask})
            # tool_result is a list of content items
            text = " ".join(
                c.text for c in tool_result if hasattr(c, "text")
            )
            results.append(f"[{crew_name}] {text[:300]}")

    return "\n\n".join(results) or plan_text
