import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class ClassCreate(BaseModel):
    name: str
    subject: str
    grade_level: str
    section: str | None = None
    academic_year: str


class ClassUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    grade_level: str | None = None
    section: str | None = None
    academic_year: str | None = None


class StudentInfo(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str


class ClassItem(BaseModel):
    id: uuid.UUID
    name: str
    subject: str
    grade_level: str
    section: str | None
    academic_year: str
    teacher_id: uuid.UUID
    institution_id: uuid.UUID
    is_archived: bool
    student_count: int
    created_at: datetime
    updated_at: datetime


class ClassDetail(ClassItem):
    students: list[StudentInfo]


class PaginatedClasses(BaseModel):
    items: list[ClassItem]
    total: int
    page: int
    per_page: int
    pages: int


class StudentInput(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr


class AddStudentsRequest(BaseModel):
    students: list[StudentInput]


class AddStudentsResponse(BaseModel):
    added: int
    already_enrolled: int
