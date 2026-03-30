import uuid
from datetime import datetime

from pydantic import BaseModel


class MaterialItem(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    filename: str
    file_type: str
    file_url: str
    preview: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
