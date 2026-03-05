#app/routers/employee.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.employee import Employee
from app.models.company import Company
from app.schemas.employee import EmployeeCreate, EmployeeOut
from datetime import datetime 

router = APIRouter(
    prefix="/employees",
    tags=["Employees"]
)



@router.post("/", response_model=EmployeeOut)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Inject the created_at timestamp before saving
    employee_data = payload.model_dump()
    employee_data["created_at"] = datetime.now().isoformat()
    employee = Employee(**employee_data)

    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.get("/", response_model=List[EmployeeOut])
def list_employees(
    company_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Employee)
    
    if company_id:
        query = query.filter(Employee.company_id == company_id)
        
    return query.offset(skip).limit(limit).all()


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    return employee