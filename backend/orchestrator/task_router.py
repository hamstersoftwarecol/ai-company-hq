def route_task(instruction: str) -> list[tuple[str, str]]:
    low = instruction.lower()
    routes: list[tuple[str, str]] = []

    if any(k in low for k in ("marketing", "reel", "campaign", "instagram", "social")):
        routes.append(("marketing", instruction))
    if any(k in low for k in ("frontend", "ui", "landing", "component", "react", "css")):
        routes.append(("frontend", instruction))
    if any(k in low for k in ("backend", "api", "database", "endpoint", "server")):
        routes.append(("backend", instruction))
    if any(k in low for k in ("mobile", "app", "ios", "android", "flutter")):
        routes.append(("mobile", instruction))
    if any(k in low for k in ("image", "imag", "photo", "visual", "dall")):
        routes.append(("images", instruction))
    if any(k in low for k in ("plan", "roadmap", "sprint", "schedule", "resource")):
        routes.append(("planning", instruction))

    if not routes:
        routes = [
            ("marketing", instruction),
            ("frontend", instruction),
            ("backend", instruction),
            ("mobile", instruction),
            ("images", instruction),
            ("planning", instruction),
        ]

    return routes
