# MIOS Payroll API 🇮🇩

A production-grade, multi-tenant Indonesian Payroll API built with FastAPI and SQLAlchemy. 

This engine is strictly compliant with standard Indonesian accounting practices, natively handling the complexity of PPh 21 (TER & Progressive rates), BPJS caps, Net/Gross-Up methods, and mid-month proration.


## ✨ Features

* **Multi-Tenant Architecture:** Manage multiple companies, each with their own JKK (Work Accident) risk categories.
* **Dynamic Compensation Schemes:** Create flexible salary packages toggling company-covered vs. employee-paid BPJS and Tax components.
* **Compliant Indonesian Tax Engine:**
  * Calculates Taxable Gross (Penghasilan Bruto) factoring in Company-paid benefits-in-kind (BPJS Kes, JKK, JKM).
  * Applies Monthly TER (Tarif Efektif Rata-Rata) brackets.
  * Calculates December Annual Reconciliation (Article 17 Progressive Tax) with Occupational Deductions (Biaya Jabatan) and PTKP.
* **Dual Calculation Methods:** * **Standard (Gross):** Base salary minus employee taxes and deductions.
  * **Gross-Up (Net):** Reverse-engineers the required gross salary to guarantee a specific Take-Home Pay using a binary search algorithm.
* **Mid-Month Proration:** Automatically adjusts base salaries for employees joining in the middle of a payroll cycle.

## 🛠 Tech Stack

* **Framework:** FastAPI
* **ORM:** SQLAlchemy 2.0
* **Validation:** Pydantic 2.0
* **Database:** SQLite (Configured and ready to scale to PostgreSQL via `psycopg`)
* **Server:** Uvicorn

## 📂 Project Structure

```text
app/
├── core/             # Database connection and session management
├── engines/          # The math! BPJS caps, PPh21 logic, TER tables, Gross-up solver
├── models/           # SQLAlchemy database schemas (Company, Employee, PayrollRecord, etc.)
├── routers/          # FastAPI route handlers mapping URLs to logic
├── schemas/          # Pydantic models for request validation and response formatting
└── main.py           # FastAPI application initialization