import os
import uuid
import llm
from datetime import datetime, timezone
from events.schemas import AgentEvent
from model_router.router import get_model_for_agent


# Keep agent answers short: long answers are slow, and in a multi-crew run they
# are fed to the other crews as context.
MAX_WORDS = int(os.environ.get("AGENT_MAX_WORDS", "400"))


class BaseCrew:
    crew_name: str = "base"

    def __init__(self, ws_manager=None, project_dir: str | None = None) -> None:
        self.ws_manager = ws_manager
        self.project_dir = project_dir

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

    def _system_prompt(self, role: str) -> str:
        if self.project_dir:
            folder = "docs" if self.crew_name == "planning" else self.crew_name
            return (
                f"{role}\n\nYou work inside the project folder (your current directory). "
                f"Create and edit the real project files there with your file tools, keeping your "
                f"files in the `{folder}/` subfolder. Never touch anything outside the project folder. "
                f"Your final answer is a brief report of what you created or changed and any open "
                f"questions: at most {MAX_WORDS} words, no preamble."
            )
        return (
            f"{role}\n\nBe concise and actionable: answer in at most {MAX_WORDS} words, "
            "no preamble, no repetition."
        )

    async def run_agent(self, agent_name: str, role: str, task: str) -> str:
        model = get_model_for_agent(agent_name)
        await self.emit_event(
            agent=agent_name, status="working", task=task, output="", model_used=model
        )
        try:
            response = await llm.acompletion(
                model=model,
                messages=[
                    {"role": "system", "content": self._system_prompt(role)},
                    {"role": "user", "content": task},
                ],
                cwd=self.project_dir,
            )
        except Exception as exc:
            await self.emit_event(
                agent=agent_name, status="error", task=task, output=str(exc), model_used=model
            )
            raise
        output = response.choices[0].message.content or ""
        await self.emit_event(
            agent=agent_name, status="complete", task=task, output=output, model_used=model
        )
        return output

    async def execute(self, task: str) -> str:
        raise NotImplementedError
