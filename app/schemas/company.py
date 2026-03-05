# app/schemas/company.py

from pydantic import BaseModel, ConfigDict

class CompanyCreate(BaseModel):
    name: str
    jkk_category: str

class CompanyOut(BaseModel):
    id: int
    name: str
    jkk_category: str

    model_config = ConfigDict(from_attributes=True)