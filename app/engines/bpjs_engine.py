# app/engines/bpjs_engine.py

# Fixed Percentages (These rarely change, unlike the salary caps)
BPJS_KES_EMPLOYEE = 0.01
BPJS_KES_COMPANY = 0.04

BPJS_JHT_EMPLOYEE = 0.02
BPJS_JHT_COMPANY = 0.037

BPJS_JP_EMPLOYEE = 0.01
BPJS_JP_COMPANY = 0.02

BPJS_JKM_COMPANY = 0.003  # 0.30%

def calculate_bpjs(
    gross_salary: float, 
    jkk_rate: float, 
    scheme: dict, 
    regulation: dict, 
    employee_age: int
) -> dict:
    if scheme is None:
        scheme = {}

    # BPJS Kesehatan (Dynamically Capped from Database)
    kes_max = regulation.get("bpjs_kes_max_salary", 12000000)
    kes_base = min(gross_salary, kes_max)
    kes_employee = kes_base * BPJS_KES_EMPLOYEE if scheme.get("cover_bpjs_kesehatan", True) else 0
    kes_company = kes_base * BPJS_KES_COMPANY if scheme.get("cover_bpjs_kesehatan", True) else 0

    # JHT (Uncapped)
    jht_employee = gross_salary * BPJS_JHT_EMPLOYEE if scheme.get("cover_bpjs_jht", True) else 0
    jht_company = gross_salary * BPJS_JHT_COMPANY if scheme.get("cover_bpjs_jht", True) else 0

    # JP (Dynamically Capped AND Age Restricted)
    # Indonesian law: JP stops at retirement age (currently 58)
    if employee_age >= 58:
        jp_employee = 0
        jp_company = 0
    else:
        jp_max = regulation.get("bpjs_jp_max_salary", 10042300)
        jp_base = min(gross_salary, jp_max)
        jp_employee = jp_base * BPJS_JP_EMPLOYEE if scheme.get("cover_bpjs_jp", True) else 0
        jp_company = jp_base * BPJS_JP_COMPANY if scheme.get("cover_bpjs_jp", True) else 0

    # JKK & JKM (Company only, uncapped)
    jkk_company = gross_salary * jkk_rate if scheme.get("cover_bpjs_jkk", True) else 0
    jkm_company = gross_salary * BPJS_JKM_COMPANY if scheme.get("cover_bpjs_jkm", True) else 0

    return {
        "kes_employee": round(kes_employee, 2),
        "kes_company": round(kes_company, 2),
        "jht_employee": round(jht_employee, 2),
        "jht_company": round(jht_company, 2),
        "jp_employee": round(jp_employee, 2),
        "jp_company": round(jp_company, 2),
        "jkk_company": round(jkk_company, 2),
        "jkm_company": round(jkm_company, 2),
        "total_employee": round(kes_employee + jht_employee + jp_employee, 2),
        "total_company": round(kes_company + jht_company + jp_company + jkk_company + jkm_company, 2)
    }