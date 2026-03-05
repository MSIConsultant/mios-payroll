import math
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.payroll import PayrollRecord
from app.models.employee import Employee
from app.engines.progressive_tax import calculate_progressive_tax
from app.engines.ptkp import PTKP

router = APIRouter(prefix="/reconciliation", tags=["Reconciliation"])

# Standard Indonesian Tax Constants
OCCUPATIONAL_DEDUCTION_RATE = 0.05
OCCUPATIONAL_DEDUCTION_MAX = 6_000_000

@router.get("/{employee_id}/{year}")
def generate_annual_tax_summary(employee_id: int, year: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    records = db.query(PayrollRecord).filter(
        PayrollRecord.employee_id == employee_id,
        PayrollRecord.year == year,
    ).all()

    if not records:
        return {"message": "No payroll records found for this year."}

    # 1. Sum up all payments and taxes for the year
    total_gross = sum(r.gross_salary for r in records)
    total_tax_paid = sum(r.pph21_final for r in records)

    # 2. Calculate Annual Deductions
    occupational_deduction = min(total_gross * OCCUPATIONAL_DEDUCTION_RATE, OCCUPATIONAL_DEDUCTION_MAX)
    net_annual_income = total_gross - occupational_deduction
    
    # 3. Apply Non-Taxable Income (PTKP) Allowance
    non_taxable_allowance = PTKP[employee.ptkp_status]["annual"]
    taxable_income = max(0, net_annual_income - non_taxable_allowance)
    
    # Standard tax rule: floor the taxable income (PKP) to the nearest thousand
    taxable_income_rounded = math.floor(taxable_income / 1000) * 1000

    # 4. Determine Actual Tax Liability
    actual_tax_liability = calculate_progressive_tax(taxable_income_rounded)
    discrepancy = actual_tax_liability - total_tax_paid

    # 5. Determine Tax Status
    if round(discrepancy, 2) == 0:
        status = "Balanced"
    elif discrepancy > 0:
        status = "Underpaid"
    else:
        status = "Overpaid"

    return {
        "year": year,
        "employee_name": employee.name,
        "tax_status_code": employee.ptkp_status,
        "total_gross_salary": total_gross,
        "occupational_deduction": occupational_deduction,
        "net_annual_income": net_annual_income,
        "non_taxable_allowance": non_taxable_allowance,
        "taxable_income": taxable_income_rounded,
        "actual_tax_liability": actual_tax_liability,
        "total_tax_paid": total_tax_paid,
        "reconciliation_status": status,
        "discrepancy_amount": round(discrepancy, 2)
    }