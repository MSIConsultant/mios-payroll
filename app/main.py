# app/main.py

from fastapi import FastAPI

from app.core.database import engine
from app.models.base import Base

from app.routers import company, employee, payroll, reconciliation, regulation, salary_scheme, accounting
app = FastAPI(title="MIOS Payroll", version="0.1.0",)

# Create tables
Base.metadata.create_all(bind=engine)

# Register routers
app.include_router(company.router)
app.include_router(employee.router)
app.include_router(payroll.router)
app.include_router(reconciliation.router)
app.include_router(salary_scheme.router)
app.include_router(accounting.router)
app.include_router(regulation.router)