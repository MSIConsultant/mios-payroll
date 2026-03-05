# app/schemas/payroll.py
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class PayrollRunCreate(BaseModel):
    company_id: int
    year: int
    month: int

class PayrollRunOut(BaseModel):
    id: int
    company_id: int
    year: int
    month: int
    status: str
    created_at: datetime
    locked_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class EmployeePayrollInput(BaseModel):
    employee_id: int
    allowances: List[float] = []
    deductions: List[float] = []  
    bonus: float = 0.0
    thr: float = 0.0
    
    # The Three Calculation Toggles:
    # 1. Standard: Both False
    # 2. Pure Net: gross_up = True
    # 3. Tax Subsidy: tax_allowance = True
    gross_up: bool = False
    tax_allowance: bool = False 
    
    target_net: float = 0.0
    is_prorated: bool = False
    proration_days: int = 0
    total_working_days: int = 21

class BulkPayrollRequest(BaseModel):
    employees: List[EmployeePayrollInput]

class PayrollRecordOut(BaseModel):
    id: int
    employee_id: int
    gross_salary: float
    tunjangan_pajak: float  # Expose the generated allowance
    deductions_total: float  
    net_salary: float
    pph21_final: float
    bpjs_employee_total: float
    bpjs_company_total: float
    model_config = ConfigDict(from_attributes=True)