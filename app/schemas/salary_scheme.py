# app/schemas/salary_scheme.py

from pydantic import BaseModel, ConfigDict
from typing import Optional

class SalarySchemeCreate(BaseModel):
    company_id: int
    name: str
    cover_bpjs_kesehatan: bool = True
    cover_bpjs_jht: bool = True
    cover_bpjs_jp: bool = True
    cover_bpjs_jkk: bool = True
    cover_bpjs_jkm: bool = True
    cover_bpjs_jkp: bool = True
    cover_pph21: bool = True
    allow_allowances: bool = True
    allow_bonus: bool = True
    allow_thr: bool = True

class SalarySchemeOut(BaseModel):
    id: int
    company_id: int
    name: str
    cover_bpjs_kesehatan: bool
    cover_bpjs_jht: bool
    cover_bpjs_jp: bool
    cover_bpjs_jkk: bool
    cover_bpjs_jkm: bool
    cover_bpjs_jkp: bool
    cover_pph21: bool
    allow_allowances: bool
    allow_bonus: bool
    allow_thr: bool
    is_active: bool

    model_config = ConfigDict(from_attributes=True)