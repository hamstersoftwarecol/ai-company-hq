from crews.base_crew import BaseCrew


class MarketingCrew(BaseCrew):
    crew_name = "marketing"

    async def execute(self, task: str) -> str:
        strategy = await self.run_agent(
            "marketing_strategist",
            "You are a senior marketing strategist. Create compelling, data-driven campaign strategies.",
            task,
        )
        reels = await self.run_agent(
            "reels_creator",
            f"You are a social media creator specializing in short-form video reels. "
            f"Based on this strategy:\n{strategy}\n\nCreate specific reel scripts and concepts.",
            task,
        )
        await self.run_agent(
            "analytics_agent",
            f"You are a marketing analyst. Review this campaign and provide KPIs and metrics to track:\n"
            f"{strategy}\n{reels}",
            task,
        )
        return reels
