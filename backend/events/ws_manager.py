import json
from collections.abc import Callable

from fastapi import WebSocket
from events.schemas import AgentEvent


class WSManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self.listeners: list[Callable[[AgentEvent], None]] = []  # e.g. to keep /agents up to date

    async def connect(self, ws: WebSocket) -> None:
        self.active_connections.append(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active_connections:
            self.active_connections.remove(ws)

    async def broadcast(self, event: AgentEvent) -> None:
        for listener in self.listeners:
            listener(event)
        payload = event.model_dump_json()
        for ws in list(self.active_connections):
            try:
                await ws.send_text(payload)
            except Exception:
                await self.disconnect(ws)

    async def broadcast_json(self, data: dict) -> None:
        """Send a non-agent message (e.g. questions for the user) to every client."""
        payload = json.dumps(data)
        for ws in list(self.active_connections):
            try:
                await ws.send_text(payload)
            except Exception:
                await self.disconnect(ws)


ws_manager = WSManager()
