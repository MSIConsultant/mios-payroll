from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.payroll import PayrollRecord
from app.schemas.accounting import JournalEntryOut
from app.engines.journal_engine import generate_monthly_journal

router = APIRouter(prefix="/accounting", tags=["Accounting"])

@router.get("/journal/{company_id}/{year}/{month}", response_model=JournalEntryOut)
def get_monthly_journal_entry(company_id: int, year: int, month: int, db: Session = Depends(get_db)):
    """
    Generates a consolidated, balanced General Ledger entry for the entire company for a specific month.
    """
    records = db.query(PayrollRecord).filter(
        PayrollRecord.company_id == company_id,
        PayrollRecord.year == year,
        PayrollRecord.month == month
    ).all()

    if not records:
        raise HTTPException(status_code=404, detail="No payroll records found for this period.")

    journal_data = generate_monthly_journal(records)

    # Double-entry bookkeeping safety check
    if round(journal_data["total_debit"], 2) != round(journal_data["total_credit"], 2):
        raise HTTPException(
            status_code=500, 
            detail=f"CRITICAL ERROR: Journal does not balance. Dr: {journal_data['total_debit']} | Cr: {journal_data['total_credit']}"
        )

    return {
        "company_id": company_id,
        "year": year,
        "month": month,
        "total_debit": journal_data["total_debit"],
        "total_credit": journal_data["total_credit"],
        "lines": journal_data["lines"]
    }