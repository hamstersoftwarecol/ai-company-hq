import uuid
import llm
from datetime import datetime, timezone
from events.schemas import AgentEvent
from model_router.router import get_model_for_agent


class BaseCrew:
    crew_name: str = "base"

    def __init__(self, ws_manager=None) -> None:
        self.ws_manager = ws_manager

    async def emit_event(
        self, agent: str, status: str, task: str, output: str, model_used: str
    ) -> AgentEvent:
        event = AgentEvent(
            event_id=str(uuid.uuid4()),
            agent=agent,
            crew=self.crew_name,
            status=status,
            task=task,
            output=output,
            model_used=model_used,
            timestamp=datetime.now(timezone.utc),
        )
        if self.ws_manager:
            await self.ws_manager.broadcast(event)
        return event

    async def run_agent(self, agent_name: str, role: str, task: str) -> str:
        model = get_model_for_agent(agent_name)
        await self.emit_event(
            agent=agent_name, status="working", task=task, output="", model_used=model
        )
        response = await llm.acompletion(
            model=model,
            messages=[
                {"role": "system", "content": role},
                {"role": "user", "content": task},
            ],
        )
        output = response.choices[0].message.content or ""
        await self.emit_event(
            agent=agent_name, status="complete", task=task, output=output, model_used=model
        )
        return output

    async def execute(self, task: str) -> str:
        raise NotImplementedError
