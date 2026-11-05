from crews.base_crew import BaseCrew


class PlanningCrew(BaseCrew):
    crew_name = "planning"

    async def execute(self, task: str) -> str:
        roadmap = await self.run_agent(
            "project_planner",
            "You are a senior project planner. Create detailed roadmaps, sprint plans, and milestones.",
            task,
        )
        resources = await self.run_agent(
            "resource_manager",
            f"You are a resource manager. Based on this roadmap:\n{roadmap}\n\n"
            "Assign crews, estimate effort, and prioritize tasks.",
            task,
        )
        return resources
