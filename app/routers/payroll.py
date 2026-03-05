# app/routers/payroll.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import List

from app.core.database import get_db
from app.models.payroll import PayrollRun, PayrollRecord
from app.models.employee import Employee
from app.models.company import Company
from app.models.salary_scheme import SalaryScheme
from app.models.regulation import TaxRegulation
from app.schemas.payroll import PayrollRunCreate, PayrollRunOut, BulkPayrollRequest, PayrollRecordOut

from app.engines.payroll_engine import solve_gross_up, solve_tax_allowance
from app.engines.bpjs_engine import calculate_bpjs

router = APIRouter(prefix="/payroll", tags=["Payroll"])

@router.post("/runs", response_model=PayrollRunOut)
def create_payroll_run(run_in: PayrollRunCreate, db: Session = Depends(get_db)):
    existing_run = db.query(PayrollRun).filter(
        PayrollRun.company_id == run_in.company_id,
        PayrollRun.year == run_in.year,
        PayrollRun.month == run_in.month
    ).first()

    if existing_run:
        raise HTTPException(status_code=400, detail="A payroll run for this month already exists.")

    new_run = PayrollRun(
        company_id=run_in.company_id,
        year=run_in.year,
        month=run_in.month,
        status="DRAFT"
    )
    db.add(new_run)
    db.commit()
    db.refresh(new_run)
    return new_run

@router.post("/runs/{run_id}/lock")
def lock_payroll_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")
    
    if run.status == "LOCKED":
        raise HTTPException(status_code=400, detail="Payroll run is already locked.")

    run.status = "LOCKED"
    run.locked_at = datetime.utcnow()
    db.commit()
    return {"message": f"Payroll run {run_id} successfully locked. General Ledger is now final."}

@router.post("/runs/{run_id}/process_bulk", response_model=List[PayrollRecordOut])
def process_bulk_payroll(run_id: int, request: BulkPayrollRequest, db: Session = Depends(get_db)):
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")
    if run.status == "LOCKED":
        raise HTTPException(status_code=403, detail="Cannot process payroll. This period is LOCKED.")

    regulation = db.query(TaxRegulation).filter(TaxRegulation.active_year == run.year).first()
    if not regulation:
        raise HTTPException(status_code=500, detail=f"Tax Regulations for year {run.year} are not configured.")
    reg_dict = {
        "bpjs_kes_max_salary": regulation.bpjs_kes_max_salary,
        "bpjs_jp_max_salary": regulation.bpjs_jp_max_salary,
        "biaya_jabatan_rate": regulation.biaya_jabatan_rate,
        "biaya_jabatan_max_annual": regulation.biaya_jabatan_max_annual
    }

    company = db.query(Company).filter(Company.id == run.company_id).first()
    jkk_rate = {"LOW": 0.0024, "MEDIUM": 0.0054, "HIGH": 0.0089}.get(company.jkk_category, 0.0024)

    db.query(PayrollRecord).filter(PayrollRecord.payroll_run_id == run_id).delete()

    generated_records = []

    for item in request.employees:
        emp = db.query(Employee).filter(Employee.id == item.employee_id).first()
        if not emp:
            continue

        scheme_orm = db.query(SalaryScheme).filter(SalaryScheme.id == emp.salary_scheme_id).first()
        scheme_dict = {c.name: getattr(scheme_orm, c.name) for c in SalaryScheme.__table__.columns} if scheme_orm else {}

        today = date(run.year, run.month, 1)
        age = today.year - emp.date_of_birth.year - ((today.month, today.day) < (emp.date_of_birth.month, emp.date_of_birth.day))

        total_custom_deductions = sum(item.deductions)
        
        calculated_base = emp.base_salary 
        if item.is_prorated:
            calculated_base = (item.proration_days / item.total_working_days) * emp.base_salary

        tunjangan_pajak = 0.0

        if item.gross_up:
            calculated_base = solve_gross_up(
                target_net=item.target_net,
                allowances=item.allowances,
                bonus=item.bonus,
                thr=item.thr,
                month=run.month,
                ptkp_status=emp.ptkp_status,
                cumulative_taxable_gross_before=0, 
                cumulative_tax_before=0,
                cumulative_jht_jp_employee_before=0,
                jkk_rate=jkk_rate,
                scheme=scheme_dict,
                regulation=reg_dict,
                employee_age=age
            )
        elif item.tax_allowance:
            # Keeps the base salary intact, generates the exact allowance needed to cover PPh21
            tunjangan_pajak = solve_tax_allowance(
                base_salary=calculated_base,
                allowances=item.allowances,
                bonus=item.bonus,
                thr=item.thr,
                month=run.month,
                ptkp_status=emp.ptkp_status,
                cumulative_taxable_gross_before=0,
                cumulative_tax_before=0,
                cumulative_jht_jp_employee_before=0,
                jkk_rate=jkk_rate,
                scheme=scheme_dict,
                regulation=reg_dict,
                employee_age=age
            )

        # The new Gross is Base + Standard Allowances + The new Tunjangan PPh + Bonus + THR
        gross = calculated_base + sum(item.allowances) + tunjangan_pajak + item.bonus + item.thr
        
        bpjs = calculate_bpjs(gross, jkk_rate, scheme_dict, reg_dict, age)
        
        # In a real environment, you pull the PPh21 from the forward progressive tax engine here.
        # Setting to tunjangan_pajak here to illustrate the exact match for non-December months.
        pph21 = tunjangan_pajak if item.tax_allowance else 0 
        
        taxable_net = gross - bpjs["total_employee"] - pph21
        final_take_home_pay = taxable_net - total_custom_deductions

        record = PayrollRecord(
            payroll_run_id=run.id,
            employee_id=emp.id,
            company_id=run.company_id,
            year=run.year,
            month=run.month,
            base_salary=calculated_base,
            allowances_total=sum(item.allowances),
            tunjangan_pajak=tunjangan_pajak,
            bonus=item.bonus,
            thr=item.thr,
            gross_salary=gross,
            deductions_total=total_custom_deductions,
            net_salary=final_take_home_pay,
            bpjs_employee_total=bpjs["total_employee"],
            bpjs_company_total=bpjs["total_company"],
            pph21_final=pph21,
            created_at=str(datetime.utcnow())
        )
        db.add(record)
        generated_records.append(record)

    db.commit()

    return generated_records