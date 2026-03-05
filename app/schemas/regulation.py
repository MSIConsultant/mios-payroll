#app/schemas/regulation.py

from pydantic import BaseModel, ConfigDict
from typing import Optional

class TaxRegulationBase(BaseModel):
    active_year: int
    bpjs_kes_max_salary: float
    bpjs_jp_max_salary: float
    biaya_jabatan_rate: float
    biaya_jabatan_max_annual: float
    is_active: bool = True

class TaxRegulationCreate(TaxRegulationBase):
    pass

class TaxRegulationUpdate(BaseModel):
    bpjs_kes_max_salary: Optional[float] = None
    bpjs_jp_max_salary: Optional[float] = None
    biaya_jabatan_rate: Optional[float] = None
    biaya_jabatan_max_annual: Optional[float] = None
    is_active: Optional[bool] = None

class TaxRegulationOut(TaxRegulationBase):
    id: int
    model_config = ConfigDict(from_attributes=True)