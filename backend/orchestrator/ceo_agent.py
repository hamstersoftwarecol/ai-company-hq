"""
CEO agent — autonomous coordinator of all crews, over MCP.

Flow (a loop of rounds, no human in between):
1. The CEO sees the instruction plus everything the crews have produced so far
   and answers with a JSON decision: which crews to call next (and with what
   subtask), or that the work is done.
2. The crews of one round run in parallel through MCP tool calls.
3. Their outputs are fed back to the CEO and passed as context to the crews of
   the next rounds, so downstream crews build on what upstream crews produced.
4. It stops when the CEO says it is done, or after CEO_MAX_ROUNDS rounds.
"""
import asyncio
import json
import os
import re
from collections.abc import Awaitable, Callable

import llm
from fastmcp import Client
from events.ws_manager import WSManager
from crews.base_crew import BaseCrew
from model_router.router import get_model_for_agent
from mcp_servers.crew_server import get_server
from orchestrator.clarify import FOLDER_QUESTION, clarifying_questions, format_answers

CREW_NAMES = ["marketing", "frontend", "backend", "mobile", "images", "planning"]

MAX_ROUNDS = int(os.environ.get("CEO_MAX_ROUNDS", "3"))
_CONTEXT_CHARS = 1500  # how much of each crew output is shown to the CEO / next crews

_CEO_SYSTEM = """You are the CEO of an AI company. You coordinate these crews:
- marketing: strategy, reels, analytics
- frontend: UI/UX, React
- backend: API, database, infra
- mobile: iOS and Android
- images: graphic design and image generation
- planning: project management and roadmap

You work autonomously in rounds. Each round you receive the user's instruction and
the work the crews have already delivered. Decide the next step and answer with ONLY
a JSON object (no prose, no markdown, no tool calls):

{"calls": [{"crew": "<name>", "task": "<focused, self-contained subtask>"}], "done": false, "summary": ""}

Rules:
- Only call crews that are truly relevant. At most one call per crew per round.
- Crews in the same round run in parallel and cannot see each other. If one crew
  needs another's output (e.g. planning before development), call the first one now
  and the second one in a later round: it will receive the earlier results.
- When the delivered work fully covers the instruction, answer
  {"calls": [], "done": true, "summary": "<short summary of what was achieved>"}.
- Write tasks and the summary in the same language as the user's instruction.
"""


def _strip_fences(text: str) -> str:
    clean = text.strip()
    if clean.startswith("```"):
        parts = clean.split("```")
        clean = parts[1] if len(parts) > 1 else clean
        if clean.startswith("json"):
            clean = clean[4:]
    return clean.strip()


_INVOKE_RE = re.compile(
    r'<invoke name="(?P<crew>\w+)">\s*<parameter name="task">(?P<task>.*?)</parameter>', re.DOTALL
)


def parse_decision(text: str) -> dict | None:
    """Turn the CEO's reply into {"calls": [...], "done": bool, "summary": str}, or None."""
    clean = _strip_fences(text)
    data = None
    # Try whichever JSON delimiter appears first, so "[{...}]" parses as the list.
    pairs = sorted((("{", "}"), ("[", "]")), key=lambda p: (clean.find(p[0]) if p[0] in clean else len(clean)))
    for opener, closer in pairs:
        start, end = clean.find(opener), clean.rfind(closer)
        if start != -1 and end > start:
            try:
                data = json.loads(clean[start : end + 1])
                break
            except json.JSONDecodeError:
                continue
    if isinstance(data, list):
        data = {"calls": data, "done": False, "summary": ""}
    if isinstance(data, dict):
        calls = data.get("calls")
        return {
            "calls": [c for c in calls if isinstance(c, dict)] if isinstance(calls, list) else [],
            "done": bool(data.get("done")),
            "summary": str(data.get("summary") or ""),
        }
    # The model sometimes writes pseudo tool calls (<invoke name="planning">...) as text.
    invokes = [{"crew": m["crew"], "task": m["task"].strip()} for m in _INVOKE_RE.finditer(text)]
    if invokes:
        return {"calls": invokes, "done": False, "summary": ""}
    return None


def _progress_text(instruction: str, delivered: list[dict]) -> str:
    if not delivered:
        return f"Instruction:\n{instruction}\n\nNo work has been delivered yet."
    blocks = [
        f"[{d['crew']}] task: {d['task']}\n{'ERROR' if d['error'] else 'output'}: {d['output'][:_CONTEXT_CHARS]}"
        for d in delivered
    ]
    return f"Instruction:\n{instruction}\n\nWork delivered so far:\n\n" + "\n\n".join(blocks)


def _task_with_context(task: str, delivered: list[dict]) -> str:
    done = [d for d in delivered if not d["error"]]
    if not done:
        return task
    context = "\n\n".join(f"[{d['crew']}]\n{d['output'][:_CONTEXT_CHARS]}" for d in done)
    return f"{task}\n\nContext — work already delivered by other crews:\n{context}"


async def _decide(model: str, instruction: str, delivered: list[dict]) -> dict | None:
    messages = [
        {"role": "system", "content": _CEO_SYSTEM},
        {"role": "user", "content": _progress_text(instruction, delivered)},
    ]
    for attempt in range(2):
        response = await llm.acompletion(model=model, messages=messages)
        text = response.choices[0].message.content or ""
        decision = parse_decision(text)
        if decision is not None:
            return decision
        messages = messages + [
            {"role": "assistant", "content": text},
            {"role": "user", "content": "That was not valid JSON. Reply with ONLY the JSON object described."},
        ]
    return None


AskUser = Callable[[list[dict]], Awaitable[dict[str, str]]]


async def process_instruction(
    instruction: str,
    ws_manager: WSManager,
    ask: AskUser | None = None,
    project_dir: str | None = None,
) -> str:
    """Run an instruction end to end.

    If `ask` is given, the CEO first asks the user clarifying questions plus the
    project folder (`ask` receives the questions and returns the answers, with the
    folder under "folder"). Crews then work inside that folder.
    """
    base = BaseCrew(ws_manager=ws_manager)
    base.crew_name = "orchestrator"
    model = get_model_for_agent("ceo_agent")

    await base.emit_event(
        agent="ceo_agent", status="working",
        task=instruction, output="", model_used=model,
    )

    if ask is not None:
        try:
            questions = await clarifying_questions(model, instruction) + [FOLDER_QUESTION]
            await base.emit_event(
                agent="ceo_agent", status="working", task=instruction, model_used=model,
                output="Esperando tus respuestas…",
            )
            answers = await ask(questions)
        except Exception as exc:
            await base.emit_event(
                agent="ceo_agent", status="error", task=instruction, output=str(exc), model_used=model,
            )
            raise
        project_dir = answers.get("folder") or project_dir
        extra = format_answers(questions, answers)
        if extra:
            instruction = f"{instruction}\n\nRespuestas del usuario a las preguntas del CEO:\n{extra}"

    delivered: list[dict] = []   # {crew, task, output, error}
    seen: set[tuple[str, str]] = set()
    summary = ""
    try:
        for round_no in range(1, MAX_ROUNDS + 1):
            decision = await _decide(model, instruction, delivered)
            if decision is None:
                if delivered:
                    break
                # The CEO never produced a usable plan: hand the whole job to planning.
                decision = {"calls": [{"crew": "planning", "task": instruction}], "done": False, "summary": ""}

            calls = []
            for item in decision["calls"]:
                crew, task = str(item.get("crew", "")), str(item.get("task") or instruction)
                if crew in CREW_NAMES and (crew, task) not in seen and crew not in [c[0] for c in calls]:
                    seen.add((crew, task))
                    calls.append((crew, task))
            if decision["done"] or not calls:
                summary = decision["summary"]
                break

            await base.emit_event(
                agent="ceo_agent", status="working", task=instruction, model_used=model,
                output=f"Ronda {round_no}: " + ", ".join(c for c, _ in calls),
            )
            results = await asyncio.gather(
                *(dispatch_to_crew(crew, _task_with_context(task, delivered), project_dir) for crew, task in calls),
                return_exceptions=True,
            )
            failures = [r for r in results if isinstance(r, BaseException)]
            for (crew, task), res in zip(calls, results):
                err = isinstance(res, BaseException)
                delivered.append({"crew": crew, "task": task, "output": str(res) if err else res, "error": err})
            if len(failures) == len(results):
                raise failures[0]
    except Exception as exc:
        await base.emit_event(
            agent="ceo_agent", status="error",
            task=instruction, output=str(exc), model_used=model,
        )
        raise

    ok = [d for d in delivered if not d["error"]]
    report = "\n\n".join(f"[{d['crew']}] {d['output'][:300]}" for d in ok)
    final = (summary + ("\n\n" + report if report else "")).strip() or "Sin trabajo que delegar."
    await base.emit_event(
        agent="ceo_agent", status="complete",
        task=instruction, output=summary or final, model_used=model,
    )
    return final


async def dispatch_to_crew(crew: str, task: str, project_dir: str | None = None) -> str:
    """Call one crew's MCP tool directly (used by the CEO and by direct assignment)."""
    if crew not in CREW_NAMES:
        raise ValueError(f"Unknown crew: {crew}")
    args = {"task": task}
    if project_dir:
        args["project_dir"] = project_dir
    async with Client(get_server()) as client:
        result = await client.call_tool(crew, args)
    return " ".join(c.text for c in result.content if hasattr(c, "text"))
