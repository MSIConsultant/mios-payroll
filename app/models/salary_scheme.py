# app/models/salary_scheme.py

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.models.base import Base

class SalaryScheme(Base):
    __tablename__ = "salary_schemes"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g., "Scheme A - Full Coverage"
    
    # Fixed components (company covers?)
    cover_bpjs_kesehatan = Column(Boolean, default=True)
    cover_bpjs_jht = Column(Boolean, default=True)
    cover_bpjs_jp = Column(Boolean, default=True)
    cover_bpjs_jkk = Column(Boolean, default=True)
    cover_bpjs_jkm = Column(Boolean, default=True)
    cover_bpjs_jkp = Column(Boolean, default=True)
    cover_pph21 = Column(Boolean, default=True)
    
    # Variable components (allowed?)
    allow_allowances = Column(Boolean, default=True)
    allow_bonus = Column(Boolean, default=True)
    allow_thr = Column(Boolean, default=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(String, nullable=False)  # ISO timestamp