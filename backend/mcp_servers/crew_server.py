"""
MCP server that exposes each crew as a callable tool.
The CEO agent connects to this server via fastmcp.Client(server)
to dispatch work to crews through the Model Context Protocol.
"""
from fastmcp import FastMCP

# Single shared server instance — created once, reused across requests
_server: FastMCP | None = None
# ws_manager injected at startup
_ws_manager = None


def get_server() -> FastMCP:
    global _server
    if _server is None:
        _server = _build_server()
    return _server


def set_ws_manager(ws_manager) -> None:
    global _ws_manager
    _ws_manager = ws_manager


def _project(project_dir: str) -> str | None:
    """Validate the optional project folder (inside ~) and return it, or None."""
    if not project_dir:
        return None
    from orchestrator.project import resolve_project_dir
    return str(resolve_project_dir(project_dir))


def _build_server() -> FastMCP:
    mcp = FastMCP(
        name="AI Company Crews",
        instructions=(
            "Tools for dispatching work to specialized AI crews inside the company. "
            "Each tool runs the full crew pipeline and returns the final output. "
            "Pass project_dir (a folder inside the user's home) so the crew writes its files there."
        ),
    )

    @mcp.tool(description="Run the Marketing crew: strategy, reels, and analytics.")
    async def marketing(task: str, project_dir: str = "") -> str:
        from crews.marketing_crew import MarketingCrew
        return await MarketingCrew(ws_manager=_ws_manager, project_dir=_project(project_dir)).execute(task)

    @mcp.tool(description="Run the Frontend crew: UI/UX design and React implementation.")
    async def frontend(task: str, project_dir: str = "") -> str:
        from crews.frontend_crew import FrontendCrew
        return await FrontendCrew(ws_manager=_ws_manager, project_dir=_project(project_dir)).execute(task)

    @mcp.tool(description="Run the Backend crew: API, database, and infrastructure.")
    async def backend(task: str, project_dir: str = "") -> str:
        from crews.backend_crew import BackendCrew
        return await BackendCrew(ws_manager=_ws_manager, project_dir=_project(project_dir)).execute(task)

    @mcp.tool(description="Run the Mobile crew: iOS and Android development.")
    async def mobile(task: str, project_dir: str = "") -> str:
        from crews.mobile_crew import MobileCrew
        return await MobileCrew(ws_manager=_ws_manager, project_dir=_project(project_dir)).execute(task)

    @mcp.tool(description="Run the Images crew: graphic design and image generation.")
    async def images(task: str, project_dir: str = "") -> str:
        from crews.images_crew import ImagesCrew
        return await ImagesCrew(ws_manager=_ws_manager, project_dir=_project(project_dir)).execute(task)

    @mcp.tool(description="Run the Planning crew: project management and roadmap.")
    async def planning(task: str, project_dir: str = "") -> str:
        from crews.planning_crew import PlanningCrew
        return await PlanningCrew(ws_manager=_ws_manager, project_dir=_project(project_dir)).execute(task)

    return mcp
