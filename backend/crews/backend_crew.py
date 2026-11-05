from crews.base_crew import BaseCrew


class BackendCrew(BaseCrew):
    crew_name = "backend"

    async def execute(self, task: str) -> str:
        architecture = await self.run_agent(
            "backend_architect",
            "You are a senior backend architect designing FastAPI services. "
            "Define endpoints, DB schema, and service boundaries.",
            task,
        )
        implementation = await self.run_agent(
            "backend_developer",
            f"You are a Python developer implementing FastAPI endpoints. "
            f"Based on this architecture:\n{architecture}\n\nWrite the implementation code.",
            task,
        )
        return implementation
