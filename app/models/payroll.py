# app/models/payroll.py
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean, DateTime
from app.models.base import Base
import datetime

class PayrollRun(Base):
    """
    Acts as the master lock for a specific company's monthly payroll.
    """
    __tablename__ = "payroll_runs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    status = Column(String, default="DRAFT", nullable=False) 
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    locked_at = Column(DateTime, nullable=True)


class PayrollRecord(Base):
    __tablename__ = "payroll_records"

    id = Column(Integer, primary_key=True, index=True)
    payroll_run_id = Column(Integer, ForeignKey("payroll_runs.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    
    # === BASE & ALLOWANCES ===
    base_salary = Column(Float, nullable=False)
    allowances_json = Column(String, nullable=True)
    allowances_total = Column(Float, default=0)
    
    # NEW: Stores the calculated Tax Subsidy (Tunjangan PPh)
    tunjangan_pajak = Column(Float, default=0) 
    
    bonus = Column(Float, default=0)
    thr = Column(Float, default=0)
    
    # === GROSS ===
    gross_salary = Column(Float, nullable=False)
    
    # === BPJS EMPLOYEE ===
    bpjs_jht_employee = Column(Float, default=0)
    bpjs_jp_employee = Column(Float, default=0)
    bpjs_kesehatan_employee = Column(Float, default=0)
    bpjs_employee_total = Column(Float, default=0)
    
    # === PPh21 ===
    pph21_ter = Column(Float, default=0)
    pph21_annual = Column(Float, default=0)
    pph21_final = Column(Float, default=0)
    
    # === BPJS COMPANY ===
    bpjs_jht_company = Column(Float, default=0)
    bpjs_jp_company = Column(Float, default=0)
    bpjs_jkk_company = Column(Float, default=0)
    bpjs_jkm_company = Column(Float, default=0)
    bpjs_jkp_company = Column(Float, default=0)
    bpjs_kesehatan_company = Column(Float, default=0)
    bpjs_company_total = Column(Float, default=0)
    
    # === CUSTOM DEDUCTIONS (Post-Tax) ===
    deductions_json = Column(String, nullable=True)  
    deductions_total = Column(Float, default=0)
    
    # === NET ===
    net_salary = Column(Float, nullable=False)  
    
    # === METADATA ===
    is_prorated = Column(Boolean, default=False)
    proration_days = Column(Integer, nullable=True)
    is_reconciled = Column(Boolean, default=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=True)