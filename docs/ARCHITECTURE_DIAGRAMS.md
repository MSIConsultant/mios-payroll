# MIOS Payroll Engine - System Architecture & Flow Diagrams

## 1. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   MIOS PAYROLL ENGINE                           │
└─────────────────────────────────────────────────────────────────┘

                         USER/ACCOUNTANT
                              │
                              ▼
                    ┌──────────────────┐
                    │   API Request    │
                    │  (FastAPI)       │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
         ┌────────────────────┐  ┌──────────────────┐
         │ Tax Engine         │  │ BPJS Engine      │
         │                    │  │                  │
         │ • PPh 21 TER       │  │ • Kesehatan      │
         │ • PTKP Status      │  │ • JHT            │
         │ • Progressive Tax  │  │ • JP             │
         │                    │  │ • JKK (Risk)     │
         └────────────────────┘  └──────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Payroll Service  │
                    │                   │
                    │ Orchestrates:     │
                    │ • Aggregates      │
                    │ • Calculates      │
                    │ • Formats         │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Database Store    │
                    │  (PostgreSQL)      │
                    │                    │
                    │ Tables:            │
                    │ • Payroll Records  │
                    │ • Tax Calculations │
                    │ • BPJS Details     │
                    └────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Response to User   │
                    │ (JSON)             │
                    └────────────────────┘
```

---

## 2. Payroll Calculation Flow

```
START: Monthly Payroll Calculation
│
├─ INPUT EMPLOYEE DATA
│  ├─ Employee Name
│  ├─ Salary Components (7 types)
│  ├─ PTKP Status (TK0, K1, K3, etc)
│  ├─ JKK Risk Level (SR, R, S, T, ST)
│  └─ Employer Config (who pays what)
│
├─ AGGREGATE BRUTO
│  ├─ Gaji Pokok: Rp 5.000.000
│  ├─ Tunjangan Transport: Rp 500.000
│  ├─ Tunjangan Makan: Rp 300.000
│  ├─ Tunjangan Komunikasi: Rp 200.000
│  ├─ Tunjangan Perumahan: Rp 1.000.000
│  └─ TOTAL BRUTO = Rp 7.000.000
│
├─ CALCULATE PPh 21 (TAX)
│  ├─ Look up PTKP Status → Get TER Category
│  │  Contoh: K1 → TER_B
│  │
│  ├─ Find TER Bracket for Bruto amount
│  │  Contoh: Rp 7M → 5% rate
│  │
│  └─ PPh21 = Bruto × TER_Rate
│     Contoh: Rp 7M × 5% = Rp 350.000
│
├─ CALCULATE BPJS CONTRIBUTIONS
│  ├─ BPJS Kesehatan (4% employer + 1% employee)
│  │  └─ Base capped at Rp 12M
│  │
│  ├─ BPJS JHT (3.7% employer + 2% employee)
│  │
│  ├─ BPJS JP (2% employer + 1% employee)
│  │
│  └─ BPJS JKK (risk-based, employer only)
│     Contoh: Risk Level S = 0.89%
│
├─ DETERMINE LIABILITY (Who Pays What?)
│  ├─ IF employer_bears_pph21 = true
│  │  └─ Employee portion = Rp 0, Employer pays all
│  │
│  └─ IF employer_bears_bpjs = true
│     └─ Employee BPJS = Rp 0, Employer pays all
│
├─ CALCULATE NET SALARY
│  └─ Net = Bruto - (Employee PPh21) - (Employee BPJS)
│     Contoh: Rp 7M - Rp 175k - Rp 280k = Rp 6.545.000
│
├─ CALCULATE EMPLOYER COST
│  └─ Total Cost = Bruto + (Employer PPh21) + (Employer BPJS)
│     Contoh: Rp 7M + Rp 0 + Rp 741.230 = Rp 7.741.230
│
└─ OUTPUT COMPLETE BREAKDOWN
   ├─ Component Breakdown
   ├─ Tax Details
   ├─ BPJS Details
   ├─ Employee Deductions
   ├─ Net Salary
   ├─ Employer Cost
   └─ Configuration Used
```

---

## 3. PPh 21 Calculation Details

```
PTKP STATUS → TER CATEGORY → TAX BRACKET
│
├─ TK0 (Rp 54M/year) ──→ TER_A ──→ Bracket A
├─ K0 (Rp 58.5M/year) ─→ TER_B ──→ Bracket B
├─ K1 (Rp 63M/year) ───→ TER_B ──→ Bracket B
├─ K2 (Rp 67.5M/year) ─→ TER_B ──→ Bracket B
└─ K3 (Rp 72M/year) ───→ TER_C ──→ Bracket C

EXAMPLE: K1 with Rp 7M Bruto
│
├─ PTKP Status: K1
├─ PTKP Annual: Rp 63M
├─ TER Category: TER_B
│
├─ TER_B Brackets:
│  ├─ Rp 0 - 2.812.500 = 0%
│  ├─ Rp 2.812.501 - 5.625.000 = 5%
│  ├─ Rp 5.625.001 - 11.250.000 = 10%  ← Rp 7M falls here
│  ├─ Rp 11.250.001 - 22.500.000 = 15%
│  └─ > Rp 22.500.000 = 20%
│
├─ Tax Rate for Rp 7M: 10%
│
└─ BUT: System also considers brackets below
   ├─ Rp 0 - 2.812.500 × 0% = Rp 0
   ├─ Rp 2.812.501 - 5.625.000 × 5% = ...
   ├─ Rp 5.625.001 - 7.000.000 × 10% = ...
   └─ Total calculated carefully with Decimal precision
```

---

## 4. BPJS Contribution Breakdown

```
BRUTO = Rp 7.000.000
│
├─ KESEHATAN (Health)
│  ├─ Employer: Rp 7M × 4% = Rp 280.000
│  ├─ Employee: Rp 7M × 1% = Rp 70.000
│  ├─ Base capped at: Rp 12M (max)
│  └─ Since Rp 7M < cap: normal rates apply
│
├─ JHT (Old Age/Pension)
│  ├─ Employer: Rp 7M × 3.7% = Rp 259.000  
│  ├─ Employee: Rp 7M × 2% = Rp 140.000
│  └─ No cap
│
├─ JP (Disability/Death)
│  ├─ Employer: Rp 7M × 2% = Rp 140.000
│  ├─ Employee: Rp 7M × 1% = Rp 70.000
│  └─ No cap
│
└─ JKK (Work Accident) - RISK-BASED
   ├─ Risk Level: S (Sedang) = 0.89%
   ├─ Employer: Rp 7M × 0.89% = Rp 62.230
   ├─ Employee: Rp 0 (always employer only)
   │
   └─ Risk Level Options:
      ├─ SR (Sangat Rendah) = 0.24%
      ├─ R (Rendah) = 0.54%
      ├─ S (Sedang) = 0.89%
      ├─ T (Tinggi) = 1.27%
      └─ ST (Sangat Tinggi) = 1.74%

TOTAL BPJS:
├─ Employee Portion: Rp 70k + Rp 140k + Rp 70k = Rp 280.000
├─ Employer Portion: Rp 280k + Rp 259k + Rp 140k + Rp 62.230 = Rp 741.230
└─ Total: Rp 1.021.230
```

---

## 5. Database Schema Relationships

```
Companies
│
├─── Employees
│    │
│    ├─── EmployeeSalaryProfile
│    │    (Gaji, Tunjangan, JKK Risk, Config)
│    │
│    ├─── Payroll Records
│    │    (Monthly history of calculations)
│    │
│    └─── Tax Records
│         (PPh21 details per month)
│
├─── SalaryComponent
│    (Component type master data)
│
└─── BenefitConfiguration
     (Company-level benefit rules)


EXAMPLE QUERY FLOW:
SELECT *
FROM Employees e
JOIN EmployeeSalaryProfile esp ON e.id = esp.employee_id
JOIN Company c ON e.company_id = c.id
WHERE e.company_id = 'company_123'
AND esp.valid_from <= now()
AND (esp.valid_until IS NULL OR esp.valid_until > now())
→ Get current salary profile for calculation
```

---

## 6. API Request → Response Flow

```
REQUEST
┌──────────────────────────────────────┐
│ POST /api/v1/calculation/calculate   │
├──────────────────────────────────────┤
│ {                                    │
│   "employee_name": "Budi Santoso"   │
│   "salary_components": {...}        │
│   "ptkp_status": "K1"               │
│   "jkk_risk_level": "S"             │
│   ...                               │
│ }                                   │
└──────────────────────────────────────┘
       │
       ▼
FASTAPI VALIDATION
└─── Pydantic schema check
     └─── Type conversion
     └─── Range validation

       │
       ▼
CALCULATION SERVICE
├─ TaxEngine.calculate_monthly_pph21_ter()
├─ BPJSEngine.calculate_total_bpjs()
└─ Payroll aggregation

       │
       ▼
RESPONSE
┌──────────────────────────────────────┐
│ {                                    │
│   "status": "success"                │
│   "data": {                          │
│     "bruto_monthly": 7000000,       │
│     "pph21": {...},                 │
│     "bpjs": {...},                  │
│     "summary": {                    │
│       "net_salary": 6545000,        │
│       "employer_cost": 7741230       │
│     }                               │
│   }                                 │
│ }                                   │
└──────────────────────────────────────┘
```

---

## 7. Multi-Tenant Data Isolation

```
ACCOUNTING FIRM
│
├─ CLIENT A (Company)
│  ├─ Employees (10)
│  ├─ Salary Profiles (10)
│  └─ Payroll Records (120 monthly)
│
├─ CLIENT B (Company)
│  ├─ Employees (50)
│  ├─ Salary Profiles (50)
│  └─ Payroll Records (600 monthly)
│
└─ CLIENT C (Company)
   ├─ Employees (5)
   ├─ Salary Profiles (5)
   └─ Payroll Records (60 monthly)

DATABASE LEVEL:
Every table has company_id field
└─ Row-level security by company_id
└─ Prevents data leakage between clients
```

---

## 8. Year-End Tax Reconciliation (Future)

```
DURING YEAR
├─ Each month: Calculate PPh21 with TER method
└─ Accumulate monthly taxes paid

END OF YEAR
├─ Get total annual bruto
├─ Apply PTKP annual deduction
├─ Calculate PKP (taxable income)
├─ Apply progressive tax brackets:
│  ├─ Rp 0 - 60M × 5%
│  ├─ Rp 60M - 250M × 15%
│  ├─ Rp 250M - 500M × 25%
│  ├─ Rp 500M - 5B × 30%
│  └─ > Rp 5B × 35%
│
├─ Compare:
│  ├─ Total tax from progressive = A
│  ├─ Total monthly TER tax = B
│  └─ Adjustment = A - B
│
└─ Result:
   ├─ If A > B: Employee owes more (SPT shows)
   └─ If A < B: Employee gets refund
```

---

**These diagrams show the complete architecture of MIOS Payroll Engine!**
