# app/models/employee.py

from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, Boolean
from app.models.base import Base

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    
    # Must-have
    nik = Column(String(16), nullable=False, unique=True)
    name = Column(String, nullable=False)
    alamat = Column(String, nullable=False)
    jenis_kelamin = Column(String(1), nullable=False)  # "L" or "P"
    npwp = Column(String(15), nullable=False, unique=True)
    date_of_birth = Column(Date, nullable=False) 
    join_date = Column(Date, nullable=False) 
    
    # Employment
    jabatan = Column(String, nullable=False)
    ptkp_status = Column(String, nullable=False, default="TK0")
    
    # Optional
    bagian = Column(String, nullable=True)
    resignation_date = Column(Date, nullable=True) # Essential for final paychecks
    
    # Relations
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    salary_scheme_id = Column(Integer, ForeignKey("salary_schemes.id"), nullable=True)
    
    # Bank details (optional)
    bank_account = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    
    base_salary = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(String, nullable=False)