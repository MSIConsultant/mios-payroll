# app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine
from app.models.base import Base # Assuming all your models use this Base
from app.routers import company, employee, payroll, reconciliation, regulation, salary_scheme, accounting

app = FastAPI(title="MIOS Payroll", version="0.2.0")

# --- THE FIX: CORS Configuration ---
# This explicitly tells Railway to accept clicks from your Mac and Vercel
origins = [
    "http://localhost:3000",      # Next.js local port
    "http://127.0.0.1:3000",      # Next.js local IP
    "http://localhost:8080",      # Keep Vite just in case
    "http://127.0.0.1:8080",
    "https://mios-payroll.vercel.app",  # Your deployed Next.js frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# This creates the tables in Supabase if they don't exis
Base.metadata.create_all(bind=engine)

# Register routers
app.include_router(company.router)
app.include_router(employee.router)
app.include_router(payroll.router)
app.include_router(reconciliation.router)
app.include_router(salary_scheme.router)
app.include_router(accounting.router)
app.include_router(regulation.router)