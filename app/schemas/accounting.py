#app/schemas/accounting.py

from pydantic import BaseModel
from typing import List

class JournalLine(BaseModel):
    account_name: str
    debit: float
    credit: float

class JournalEntryOut(BaseModel):
    company_id: int
    year: int
    month: int
    total_debit: float
    total_credit: float
    lines: List[JournalLine]