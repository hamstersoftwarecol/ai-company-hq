import llm
from events.ws_manager import WSManager
from crews.base_crew import BaseCrew
from model_router.router import get_model_for_agent

_CEO_SYSTEM = (
    "You are the CEO of an AI company. Break the user's instruction into subtasks "
    "for your specialized crews: marketing, frontend, backend, mobile, images, planning."
)


async def process_instruction(instruction: str, ws_manager: WSManager) -> str:
    crew = BaseCrew(ws_manager=ws_manager)
    crew.crew_name = "orchestrator"
    model = get_model_for_agent("ceo_agent")

    await crew.emit_event(
        agent="ceo_agent",
        status="working",
        task=instruction,
        output="",
        model_used=model,
    )

    response = await llm.acompletion(
        model=model,
        messages=[
            {"role": "system", "content": _CEO_SYSTEM},
            {"role": "user", "content": instruction},
        ],
    )
    plan = response.choices[0].message.content or ""

    await crew.emit_event(
        agent="ceo_agent",
        status="complete",
        task=instruction,
        output=plan,
        model_used=model,
    )
    return plan
