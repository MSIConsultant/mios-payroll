#app/engines/journal_engine.py

def generate_monthly_journal(records: list) -> dict:
    # 1. Aggregate all values from the records
    total_gross = sum(r.gross_salary for r in records)
    total_bpjs_company = sum(r.bpjs_company_total for r in records)
    
    total_bpjs_kes_payable = sum(r.bpjs_kesehatan_company + r.bpjs_kesehatan_employee for r in records)
    total_bpjs_tk_payable = sum(
        (r.bpjs_company_total - r.bpjs_kesehatan_company) + 
        r.bpjs_jht_employee + 
        r.bpjs_jp_employee 
        for r in records
    )
    
    total_tax_liability = sum(r.pph21_final for r in records)
    total_cash_out = sum(r.net_salary for r in records)

    lines = []

    # 2. Map Debits (Expenses & Reductions)
    lines.append({"account_name": "Salary Expense", "debit": total_gross, "credit": 0.0})
    lines.append({"account_name": "Benefits Expense", "debit": total_bpjs_company, "credit": 0.0})

    # Handle the December Tax Anomaly (Refunds)
    if total_tax_liability < 0:
        # Company is refunding tax to employees, reducing the company's overall tax liability
        lines.append({"account_name": "Income Tax Payable", "debit": abs(total_tax_liability), "credit": 0.0})
        total_tax_payable = 0.0
    else:
        total_tax_payable = total_tax_liability

    # 3. Map Credits (Liabilities & Cash Out)
    if total_tax_payable > 0:
        lines.append({"account_name": "Income Tax Payable", "debit": 0.0, "credit": total_tax_payable})
        
    lines.append({"account_name": "Health Ins. Payable", "debit": 0.0, "credit": total_bpjs_kes_payable})
    lines.append({"account_name": "Social Security Payable", "debit": 0.0, "credit": total_bpjs_tk_payable})
    lines.append({"account_name": "Cash / Bank", "debit": 0.0, "credit": total_cash_out})

    # 4. Calculate Totals to ensure the ledger balances
    total_debit = sum(line["debit"] for line in lines)
    total_credit = sum(line["credit"] for line in lines)

    return {
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
        "lines": lines
    }