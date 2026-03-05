#app/engines/payroll_engine.py
from app.engines.bpjs_engine import calculate_bpjs
from app.engines.ter_table import get_ter_rate
from app.engines.progressive_tax import calculate_progressive_tax
from app.engines.ptkp import PTKP

# =============================
# GROSS UP SOLVER
# =============================

def solve_gross_up(
    target_net: float,
    allowances: list[float],
    bonus: float,
    thr: float,
    month: int,
    ptkp_status: str,
    cumulative_taxable_gross_before: float,
    cumulative_tax_before: float,
    cumulative_jht_jp_employee_before: float,
    jkk_rate: float,
    scheme: dict,
    regulation: dict,
    employee_age: int
) -> float:
    """
    Returns the base salary needed to achieve target_net after deductions.
    Uses binary search to reverse-engineer the Indonesian tax brackets.
    """
    low = target_net
    high = target_net * 3  

    # Fetch dynamic limits from the regulation dictionary
    biaya_jabatan_rate = regulation.get("biaya_jabatan_rate", 0.05)
    biaya_jabatan_max = regulation.get("biaya_jabatan_max_annual", 6000000)

    for _ in range(50):
        mid = (low + high) / 2

        gross_total = mid + sum(allowances) + bonus + thr

        # 1. BPJS Dictionary (Now age-aware!)
        bpjs = calculate_bpjs(gross_total, jkk_rate, scheme, regulation, employee_age)

        # 2. Taxable Gross (Penghasilan Bruto)
        taxable_gross = gross_total + bpjs["kes_company"] + bpjs["jkk_company"] + bpjs["jkm_company"]

        # 3. PPh21 Calculation
        if month < 12:
            rate = get_ter_rate(taxable_gross, ptkp_status)
            pph = taxable_gross * rate
        else:
            annual_taxable = cumulative_taxable_gross_before + taxable_gross
            
            # Dynamic Biaya Jabatan
            biaya_jabatan = min(annual_taxable * biaya_jabatan_rate, biaya_jabatan_max)
            annual_jht_jp = cumulative_jht_jp_employee_before + bpjs["jht_employee"] + bpjs["jp_employee"]
            total_deductions = biaya_jabatan + annual_jht_jp
            
            net_annual = annual_taxable - total_deductions
            pkp = max(0, net_annual - PTKP[ptkp_status]["annual"])
            
            annual_tax = calculate_progressive_tax(pkp)
            pph = annual_tax - cumulative_tax_before

        # 4. Net Salary
        net = gross_total - bpjs["total_employee"] - pph

        # 5. Binary Search adjustment
        if net > target_net:
            high = mid
        else:
            low = mid

    return round(mid, 2)

def solve_tax_allowance(
    base_salary: float,
    allowances: list[float],
    bonus: float,
    thr: float,
    month: int,
    ptkp_status: str,
    cumulative_taxable_gross_before: float,
    cumulative_tax_before: float,
    cumulative_jht_jp_employee_before: float,
    jkk_rate: float,
    scheme: dict,
    regulation: dict,
    employee_age: int
) -> float:
    """
    Returns the exact Tunjangan Pajak needed so the allowance perfectly covers the PPh21 liability.
    """
    low = 0.0
    high = (base_salary + sum(allowances) + bonus + thr) * 2  

    biaya_jabatan_rate = regulation.get("biaya_jabatan_rate", 0.05)
    biaya_jabatan_max = regulation.get("biaya_jabatan_max_annual", 6000000)

    for _ in range(50):
        mid = (low + high) / 2  # This 'mid' is the guessed Tax Allowance

        gross_total = base_salary + sum(allowances) + mid + bonus + thr

        bpjs = calculate_bpjs(gross_total, jkk_rate, scheme, regulation, employee_age)
        taxable_gross = gross_total + bpjs["kes_company"] + bpjs["jkk_company"] + bpjs["jkm_company"]

        if month < 12:
            rate = get_ter_rate(taxable_gross, ptkp_status)
            pph = taxable_gross * rate
        else:
            annual_taxable = cumulative_taxable_gross_before + taxable_gross
            biaya_jabatan = min(annual_taxable * biaya_jabatan_rate, biaya_jabatan_max)
            annual_jht_jp = cumulative_jht_jp_employee_before + bpjs["jht_employee"] + bpjs["jp_employee"]
            total_deductions = biaya_jabatan + annual_jht_jp
            net_annual = annual_taxable - total_deductions
            pkp = max(0, net_annual - PTKP[ptkp_status]["annual"])
            annual_tax = calculate_progressive_tax(pkp)
            pph = annual_tax - cumulative_tax_before

        # If the generated tax is higher than our guessed allowance, guess higher.
        if pph > mid:
            low = mid
        else:
            high = mid

    return round(mid, 2)