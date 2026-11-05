from fastapi import WebSocket
from events.schemas import AgentEvent


class WSManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        self.active_connections.append(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active_connections:
            self.active_connections.remove(ws)

    async def broadcast(self, event: AgentEvent) -> None:
        payload = event.model_dump_json()
        for ws in list(self.active_connections):
            try:
                await ws.send_text(payload)
            except Exception:
                await self.disconnect(ws)


ws_manager = WSManager()
