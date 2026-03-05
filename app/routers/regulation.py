#app/routers/regulation.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.regulation import TaxRegulation
from app.schemas.regulation import TaxRegulationCreate, TaxRegulationUpdate, TaxRegulationOut

router = APIRouter(prefix="/regulations", tags=["Admin Settings"])

@router.post("/", response_model=TaxRegulationOut)
def create_regulation(reg_in: TaxRegulationCreate, db: Session = Depends(get_db)):
    """Creates tax and BPJS limits for a specific year."""
    existing = db.query(TaxRegulation).filter(TaxRegulation.active_year == reg_in.active_year).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Regulations for year {reg_in.active_year} already exist.")
    
    new_reg = TaxRegulation(**reg_in.model_dump())
    db.add(new_reg)
    db.commit()
    db.refresh(new_reg)
    return new_reg

@router.get("/", response_model=List[TaxRegulationOut])
def get_all_regulations(db: Session = Depends(get_db)):
    """Retrieves all historical and current tax regulations."""
    return db.query(TaxRegulation).order_by(TaxRegulation.active_year.desc()).all()

@router.get("/{year}", response_model=TaxRegulationOut)
def get_regulation_by_year(year: int, db: Session = Depends(get_db)):
    """Retrieves the specific regulations for a given year."""
    reg = db.query(TaxRegulation).filter(TaxRegulation.active_year == year).first()
    if not reg:
        raise HTTPException(status_code=404, detail=f"No regulations configured for year {year}.")
    return reg

@router.put("/{year}", response_model=TaxRegulationOut)
def update_regulation(year: int, reg_update: TaxRegulationUpdate, db: Session = Depends(get_db)):
    """Updates the caps/rates for a specific year (e.g., when the government changes the BPJS max salary)."""
    reg = db.query(TaxRegulation).filter(TaxRegulation.active_year == year).first()
    if not reg:
        raise HTTPException(status_code=404, detail=f"No regulations configured for year {year}.")
    
    update_data = reg_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(reg, key, value)
        
    db.commit()
    db.refresh(reg)
    return reg