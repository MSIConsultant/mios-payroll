# MIOS Payroll System - Deployment Quickstart

**Status**: Production-ready for deployment. Ready to store employee data and compute wage/accounting breakdowns.

---

## ✅ What's Ready

- **Employee Management**: CRUD endpoints for storing employee data (with NIK/NPWP validation)
- **Payroll Calculation**: Complete monthly calculation with PPh 21 (TER method) and BPJS contributions
- **Company-Wide Reports**: `POST /api/calculate/company/{company_id}/payroll` for bulk payroll breakdowns
- **Authentication**: JWT-based access control with company-level scoping
- **Database**: SQLAlchemy models with Alembic migrations prepared
- **Monitoring**: Sentry integration ready (set `SENTRY_DSN` env var)
- **Caching**: Redis support for performance (set `REDIS_URL` env var)

---

## 🚀 Local Setup & Run

### 1. Install Dependencies

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Set Up Environment Variables

Create a `.env` file in the workspace root:

```sh
# Database (required)
DATABASE_URL=postgresql://user:password@localhost:5432/mios_payroll

# Security (required)
SECRET_KEY=your-secret-key-here-min-32-chars

# Optional: Error tracking
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id

# Optional: Caching
REDIS_URL=redis://localhost:6379/0

# Environment
ENVIRONMENT=development
```

### 3. Apply Database Migrations

```bash
# Ensure DATABASE_URL env var is set, then run:
alembic upgrade head
```

### 4. Create Initial Admin User (Optional)

```python
# Open Python shell with venv activated
python

from app.core.password_utils import hash_password
from app.db.session import SessionLocal
from app.models.user import User
from app.models.company import Company

session = SessionLocal()

# Create a company
company = Company(
    nama="PT Mios Utama",
    nomor_identitas="1234567890123456",
    alamat="Jakarta, Indonesia",
)
session.add(company)
session.commit()

# Create admin user
user = User(
    email="admin@mios.local",
    username="admin",
    password_hash=hash_password("changeme123"),
    company_id=company.id,
    role="admin",
    is_active=True,
)
session.add(user)
session.commit()

print(f"Created company: {company.nama} (ID: {company.id})")
print(f"Created user: {user.email} (Company: {company.id})")
session.close()
```

### 5. Start the Server

**Development mode** (auto-reload):
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Production mode** (using Gunicorn):
```bash
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

The API will be available at `http://localhost:8000`  
Swagger docs: `http://localhost:8000/docs`

---

## 📋 Key API Endpoints

### Authentication
- `POST /api/auth/login` — Login with email/password
- `POST /api/auth/refresh` — Refresh access token
- `POST /api/auth/logout` — Logout

### Employee Management
- `POST /api/employees` — Create new employee
- `GET /api/employees?company_id=X&page=1&page_size=50` — List employees (paginated)
- `GET /api/employees/{employee_id}` — Get employee details
- `PUT /api/employees/{employee_id}` — Update employee
- `DELETE /api/employees/{employee_id}` — Soft-delete employee

### Payroll Calculation
- `POST /api/calculate/calculate` — Calculate payroll for a single employee (provide salary components)
- `POST /api/calculate/company/{company_id}/payroll` — Calculate payroll for **all active employees** in company
- `GET /api/calculate/ptkp-options` — Get PTKP classifications
- `GET /api/calculate/jkk-risk-levels` — Get JKK risk levels
- `GET /api/calculate/ter-brackets/{ptkp_status}` — Get TER tax brackets

### Company Management
- `POST /api/companies` — Create company
- `GET /api/companies/{company_id}` — Get company details
- `PUT /api/companies/{company_id}` — Update company
- `GET /api/companies/{company_id}/summary` — Get company summary

---

## 🔄 Typical Workflow

1. **Create Company**
   ```bash
   curl -X POST http://localhost:8000/api/companies \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"nama": "PT Contoh", "nomor_identitas": "1234567890123456", "alamat": "Jakarta"}'
   ```

2. **Create Employees**
   ```bash
   curl -X POST http://localhost:8000/api/employees \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "company_id": 1,
       "nama": "Budi Santoso",
       "nik": "3201234567890123",
       "npwp": "12345678901234",
       "status_ptkp": "K1",
       "jabatan": "Software Engineer",
       "tanggal_masuk": "2024-01-01"
     }'
   ```

3. **Calculate Company Payroll** (All emp 

loyees at once)
   ```bash
   curl -X POST http://localhost:8000/api/calculate/company/1/payroll \
     -H "Authorization: Bearer <token>"
   ```
   
   Returns:
   - Individual payroll breakdowns for each employee
   - Company-wide totals (bruto, taxes, deductions, net salary, employer cost)

4. **Export Results**
   - Use the returned JSON to generate reports/spreadsheets
   - UI will be built later for visualization

---

## 🐳 Docker Deployment

Build and run with Docker:

```bash
docker build -t mios-payroll:latest .

docker run \
  -e DATABASE_URL="postgresql://user:pass@host:5432/mios_payroll" \
  -e SECRET_KEY="your-secret-key" \
  -e SENTRY_DSN="..." \
  -e REDIS_URL="redis://host:6379/0" \
  -p 8000:8000 \
  mios-payroll:latest
```

Or use Docker Compose:
```bash
docker-compose up -d
```

---

## 📊 Data Model Summary

### Tables in Database
- `companies` — Company/organization data
- `employees` — Employee records with PTKP status, NIK, NPWP
- `users` — System user accounts (with company scoping)
- `salary_components` *(optional)* — Reusable salary definitions per employee
- `payrolls` *(optional)* — Historical payroll records

### Key Validations
- **NIK**: 16 digits
- **NPWP**: 16 digits (optional, for tax filing)
- **PTKP Status**: TK0, K0, K1, K3, K4 (Indonesian tax classifications)
- **JKK Risk Level**: SR, R, S, T, ST (work accident insurance risk)

---

## 🔒 Security Checklist

- [ ] Set `SECRET_KEY` to a strong random value (min 32 chars)
- [ ] Use HTTPS in production (not HTTP)
- [ ] Restrict database access to app containers only
- [ ] Set `ENVIRONMENT=production` in prod environment
- [ ] Configure CORS origins if frontend is separate domain
- [ ] Enable Redis with password in production
- [ ] Use managed Postgres (RDS, etc.) with strong passwords
- [ ] Rotate `SECRET_KEY` periodically (requires session cleanup)
- [ ] Monitor logs and set up Sentry alerting

---

## 🛠️ Troubleshooting

### "ModuleNotFoundError: No module named 'app'"
- Ensure you're running from workspace root
- Activate the venv: `source .venv/bin/activate`

### "psycopg2.OperationalError: connection refused"
- Check `DATABASE_URL` points to running Postgres instance
- Verify Postgres is running: `psql "$DATABASE_URL" -c "SELECT 1"`

### Alembic migration fails
- Check migration files in `alembic/versions/` are syntactically correct
- Drop and recreate test DB: `psql -c "DROP DATABASE mios_payroll;" && psql -c "CREATE DATABASE mios_payroll;"`

### JWT token expired
- Token TTL is 30 minutes. Use refresh endpoint to get new token.
- Frontend should implement automatic refresh on 401 response.

---

## 📝 Next Steps (Post-Deployment)

1. **Frontend UI** — Already partially prepared in `frontend/` folder
   - Login page, dashboard, employee management, payroll viewer
   - Will be completed separately with Ant Design components

2. **Salary Components Storage** — Currently salary is passed per-request
   - Optional: extend Employee model with default salary components
   - Add `POST /api/employees/{id}/salary` endpoint to store

3. **Historical Payroll** — Archive monthly payroll runs
   - Add Payroll model and `POST /api/payrolls` to store calculations
   - Generate year-end tax reports from historical data

4. **Batch Upload** — Excel import for bulk employee creation
   - Endpoint `/api/employees/bulk` skeleton exists
   - Requires openpyxl integration (already in dependencies)

5. **Reports/Export** — Generate PDF/Excel payroll reports
   - Use reportlab or python-docx to generate documents

---

## 📚 Documentation Files

- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) — Detailed config & migration steps
- [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md) — System design overview
- [FULL_SETUP_GUIDE.md](./FULL_SETUP_GUIDE.md) — Comprehensive setup walkthrough
- [README.md](./README.md) — Project overview

---

**Last Updated**: 2026-02-23  
**Ready to Deploy**: ✅ Yes — all core features functional
