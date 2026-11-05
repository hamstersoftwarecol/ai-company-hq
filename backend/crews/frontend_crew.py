from crews.base_crew import BaseCrew


class FrontendCrew(BaseCrew):
    crew_name = "frontend"

    async def execute(self, task: str) -> str:
        architecture = await self.run_agent(
            "frontend_architect",
            "You are a senior frontend architect designing React/Next.js applications. "
            "Define component structure, state management, and UI patterns.",
            task,
        )
        implementation = await self.run_agent(
            "frontend_developer",
            f"You are a React developer implementing components. "
            f"Based on this architecture:\n{architecture}\n\nWrite the implementation code.",
            task,
        )
        return implementation
