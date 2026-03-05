# app/models/regulation.py
from sqlalchemy import Column, Integer, Float, Boolean
from app.models.base import Base

class TaxRegulation(Base):
    """
    Stores yearly statutory limits so the code never needs to be rewritten.
    """
    __tablename__ = "tax_regulations"

    id = Column(Integer, primary_key=True, index=True)
    active_year = Column(Integer, unique=True, nullable=False) # e.g., 2024
    
    bpjs_kes_max_salary = Column(Float, default=12000000)
    bpjs_jp_max_salary = Column(Float, default=10042300)
    
    biaya_jabatan_rate = Column(Float, default=0.05)
    biaya_jabatan_max_annual = Column(Float, default=6000000)
    
    is_active = Column(Boolean, default=True)