#app/schemas/employee.py

from pydantic import BaseModel, field_validator, ConfigDict
from typing import List, Optional
from datetime import date
import re

class EmployeeCreate(BaseModel):
    name: str
    nik: str
    npwp: str
    base_salary: float
    ptkp_status: str
    jabatan: str
    alamat: str
    jenis_kelamin: str  # "L" or "P"
    company_id: int
    
    # New strict dates instead of "bulan_masuk"
    date_of_birth: date 
    join_date: date 

    # Optional
    bagian: Optional[str] = None
    resignation_date: Optional[date] = None
    salary_scheme_id: Optional[int] = None

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v):
        if not re.fullmatch(r"\d{16}", v):
            raise ValueError("NIK must be exactly 16 digits")
        return v

    @field_validator("npwp")
    @classmethod
    def validate_npwp(cls, v):
        digits = re.sub(r"\D", "", v)
        if len(digits) not in (15, 16):
            raise ValueError("NPWP must be 15 or 16 digits")
        return v

    @field_validator("jenis_kelamin")
    @classmethod
    def validate_gender(cls, v):
        if v not in ("L", "P"):
            raise ValueError("Jenis kelamin must be 'L' or 'P'")
        return v

    @field_validator("ptkp_status")
    @classmethod
    def validate_ptkp(cls, v):
        valid = {"TK0","TK1","TK2","TK3","K0","K1","K2","K3"}
        if v not in valid:
            raise ValueError(f"Invalid PTKP status. Must be one of {valid}")
        return v


class EmployeeOut(BaseModel):
    id: int
    nik: str
    name: str
    alamat: str
    jenis_kelamin: str
    npwp: str
    jabatan: str
    ptkp_status: str
    base_salary: float
    company_id: int
    
    # NEW STRICT DATES
    date_of_birth: date 
    join_date: date 
    resignation_date: Optional[date] = None
    
    salary_scheme_id: Optional[int] = None
    bagian: Optional[str] = None
    bank_account: Optional[str] = None
    bank_name: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

