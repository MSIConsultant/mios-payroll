# app/models/company.py

from sqlalchemy import Column, Integer, String, Float, Boolean
from app.models.base import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    
    # JKK category (for variable rate)
    jkk_category = Column(String, nullable=False)  # "1", "2", "3", "4"
    
    # Admin-configurable rates (updated when laws change)
    ptkp_last_updated = Column(String, nullable=True)  # ISO timestamp
    ter_last_updated = Column(String, nullable=True)
    bpjs_last_updated = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=True)