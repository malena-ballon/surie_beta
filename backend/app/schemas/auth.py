import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.institution import InstitutionType
from app.models.user import UserRole


class InstitutionCreate(BaseModel):
    name: str
    type: InstitutionType


class RegisterRequest(BaseModel):
    institution_name: str
    institution_type: InstitutionType
    email: EmailStr
    password: str
    first_name: str
    last_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class StudentRegisterRequest(BaseModel):
    join_code: str
    email: EmailStr
    password: str
    first_name: str
    last_name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    role: UserRole
    institution_id: uuid.UUID
    is_active: bool
    created_at: datetime
