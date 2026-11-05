from crews.base_crew import BaseCrew


class ImagesCrew(BaseCrew):
    crew_name = "images"

    async def execute(self, task: str) -> str:
        prompt = await self.run_agent(
            "prompt_engineer",
            "You are an expert at writing image generation prompts for DALL-E 3 and Stable Diffusion. "
            "Write detailed, vivid prompts that produce professional results.",
            task,
        )
        result = await self.run_agent(
            "image_generator",
            f"You are an image generation specialist. Given this prompt:\n{prompt}\n\n"
            "Describe the generated image in detail and suggest any refinements.",
            task,
        )
        return result
