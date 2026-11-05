from crews.base_crew import BaseCrew


class MobileCrew(BaseCrew):
    crew_name = "mobile"

    async def execute(self, task: str) -> str:
        screens = await self.run_agent(
            "mobile_developer",
            "You are a senior mobile developer building React Native and Flutter apps. "
            "Design and implement mobile screens and navigation.",
            task,
        )
        qa = await self.run_agent(
            "mobile_qa",
            f"You are a mobile QA engineer. Write test cases and identify bugs for:\n{screens}",
            task,
        )
        return qa
