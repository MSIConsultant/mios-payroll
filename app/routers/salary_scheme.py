from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.salary_scheme import SalaryScheme
from app.schemas.salary_scheme import SalarySchemeCreate, SalarySchemeOut
from datetime import datetime 

router = APIRouter(prefix="/salary_schemes", tags=["Salary Schemes"])


@router.post("/", response_model=SalarySchemeOut)
def create_salary_scheme(payload: SalarySchemeCreate, db: Session = Depends(get_db)):
    scheme_data = payload.model_dump()
    scheme_data["created_at"] = datetime.now().isoformat()
    scheme = SalaryScheme(**scheme_data)
    
    db.add(scheme)
    db.commit()
    db.refresh(scheme)
    return scheme