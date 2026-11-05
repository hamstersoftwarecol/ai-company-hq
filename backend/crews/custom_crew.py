from crews.base_crew import BaseCrew


class CustomCrew(BaseCrew):
    """A single-agent crew defined by the user (name + what it should do)."""

    def __init__(self, agent: dict, ws_manager=None, project_dir: str | None = None) -> None:
        super().__init__(ws_manager=ws_manager, project_dir=project_dir)
        self.agent = agent
        self.crew_name = agent["key"]

    async def execute(self, task: str) -> str:
        role = f"You are {self.agent['label']}, a member of the team. {self.agent['role']}"
        return await self.run_agent(f"custom_{self.agent['key']}", role, task)
