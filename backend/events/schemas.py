from pydantic import BaseModel
from typing import Literal
from datetime import datetime


class AgentEvent(BaseModel):
    event_id: str          # uuid4
    agent: str
    crew: str
    status: Literal["working", "idle", "error", "complete"]
    task: str
    output: str
    model_used: str
    timestamp: datetime
