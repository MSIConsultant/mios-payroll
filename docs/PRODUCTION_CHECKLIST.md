## **MIOS Payroll — Production Checklist (Concise, Actionable)**

This document is an executable checklist designed so another Copilot (or an SRE/dev) can pick up and perform production tasks with minimal context.

**Quick links:** [alembic.ini](alembic.ini#L1), [migration: 002_production_setup.py](alembic/versions/002_production_setup.py#L1), [requirements.txt](requirements.txt#L1), [frontend package.json](frontend/package.json#L1)

---

**Goals:**
- Harden backend for production use (secure, reliable, auditable)
- Run and verify DB migrations safely
- Add caching, rate-limiting, and monitoring
- Provide CI/CD pipeline for automated builds & deploys

---

## **Prerequisites**
- **Secrets & env:** Use a secret manager (AWS Secrets Manager, Azure KeyVault, or HashiCorp Vault). Do not commit `.env.production`.
- **Production Postgres:** Managed (RDS/Cloud SQL) or self-hosted cluster with automated backups and SSL.
- **Service accounts & keys:** SMTP, Sentry DSN, Redis URL, Docker registry credentials.

---

## **1. High-Priority Tasks (Immediate)**
- **DB migrations:** Review migration SQL and alembic configuration ([alembic.ini](alembic.ini#L1)).
- **Install runtime deps:** Ensure `python-jose[cryptography]` and `passlib[bcrypt]` are present and pinned in `requirements.txt`.
- **Run tests locally/staging:** Unit + integration smoke tests pass before touching production DB.
- **Take DB backup/snapshot** before migrations.
- **Configure Sentry** DSN in env and initialize Sentry in backend before production traffic.

---

## **2. Alembic: Review & Run Migrations (Safe workflow)**

1) Inspect migrations:

- Review: [alembic/versions/002_production_setup.py](alembic/versions/002_production_setup.py#L1) — ensure CREATE/ALTER operations are correct and reversible.

2) Ensure `alembic.ini` and `alembic/env.py` load DB URL from env var `DATABASE_URL` (do not hardcode credentials). See [alembic.ini](alembic.ini#L1).

3) Backup DB (managed snapshot or pg_dump):

```bash
# Managed (example AWS RDS snapshot)
# aws rds create-db-snapshot --db-instance-identifier mios-payroll-prod --db-snapshot-identifier before-migration-$(date +%s)

# Self-hosted (pg_dump)
PGPASSWORD=$PROD_DB_PASSWORD pg_dump -h $PROD_DB_HOST -U $PROD_DB_USER -Fc -f /tmp/mios_before_migration.dump $PROD_DB_NAME
```

4) Run migrations on staging first:

```bash
export DATABASE_URL=postgresql://user:pass@staging-host:5432/mios_staging
alembic upgrade head
```

5) Verify with smoke queries:

```bash
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
psql "$DATABASE_URL" -c "SELECT count(*) FROM alembic_version;"
```

6) Run on production (after backup):

```bash
export DATABASE_URL=postgresql://user:pass@prod-host:5432/mios_prod
alembic upgrade head
```

7) Post-migration checks: verify critical endpoints and check `alembic_version`.

---

## **3. Install Dependencies & Run Tests**

Local reproducible commands:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# If any missing runtime libs:
pip install "python-jose[cryptography]" "passlib[bcrypt]"
pytest -q
```

Notes:
- Use test DB via `DATABASE_URL` env var. Consider `testcontainers` for ephemeral DB during CI.

---

## **4. Redis Caching & Rate-Limiting (Design + Minimal steps)**

- **Redis:** use managed Redis (Elasticache) or self-hosted. Provide `REDIS_URL` via env.
- **Cache keys & TTLs:**
  - `ptkp_options` TTL 24h
  - `ter_brackets:{ptkp}` TTL 12h
  - `company_employees:{company_id}` TTL 1h
- **Implementation hints:**
  - Add `app/utils/cache.py` wrapping `aioredis` / `redis.asyncio`
  - Use cache for read-mostly reference data and expensive tax calculations
- **Rate limit:** use `slowapi` or a lightweight Redis counter middleware. Start with 100 req/min per IP.

---

## **5. Sentry: Minimal integration**

- Add to `requirements.txt`: `sentry-sdk`
- Initialize in `app/main.py` on startup:

```python
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

sentry_sdk.init(dsn=os.getenv('SENTRY_DSN'), traces_sample_rate=0.05)
app.add_middleware(SentryAsgiMiddleware)
```

- Validate by sending a test event on startup and checking Sentry dashboard.

---

## **6. CI/CD: GitHub Actions Example**

Create `.github/workflows/ci.yml` with steps: checkout, install, test, build. Minimal snippet:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with: { python-version: '3.11' }
      - name: Install deps
        run: python -m pip install -r requirements.txt
      - name: Run tests
        run: pytest -q
```

Add deploy job to build Docker images and deploy to your chosen platform with manual production approval.

---

## **7. Security & Ops (Quick reminders)**
- Secrets manager only
- TLS termination at LB
- Harden DB access (IP allowlist, IAM auth if available)
- Ensure logs do not contain NPWP/NIK in plaintext

---

## **8. Smoke Tests & Rollback Plan**

Smoke test checklist (run after deploy): login, create company, create employee, run payroll calculation. If critical test fails, restore DB snapshot or run `alembic downgrade` if reversible.

Rollback commands (example):

```bash
# downgrade last revision (if reversible)
alembic downgrade -1

# restore snapshot (managed provider or pg_restore for self-hosted)
```

---

## **Appendix — Files to inspect before production**
- `alembic.ini` ([alembic.ini](alembic.ini#L1))
- `alembic/versions/002_production_setup.py` ([alembic/versions/002_production_setup.py](alembic/versions/002_production_setup.py#L1))
- `requirements.txt` ([requirements.txt](requirements.txt#L1))
- `app/main.py` — add Sentry & graceful shutdown
- `docker-compose.yml` — local staging with Postgres + Redis

---

If you want I can now:
1. Review `alembic.ini` and `alembic/versions/002_production_setup.py` and propose edits. (recommended)
2. Create a minimal `.github/workflows/ci.yml` in the repo.
3. Scaffold `app/utils/cache.py` and a small Redis-backed cache decorator.

Reply with the number(s) you'd like me to do next and I'll continue.


### Indonesian Labor & Tax Laws
- [ ] **Verify Calculations Against:**
  - [ ] UU No. 8 Tahun 1997 (Wage Payment Law)
  - [ ] UU No. 13 Tahun 2003 (Labor Law)
  - [ ] UU No. 36 Tahun 2008 (Income Tax Law)
  - [ ] Latest BPJS contribution rates
  - [ ] Current PTKP values (updated annually in January)
  
- [ ] **Consultation**
  - [ ] Hire Indonesian tax lawyer to review
  - [ ] Test with Indonesia's DJP tax authority tools if available
  - [ ] Get sign-off from tax accountant

### Data Protection (GDP Equivalent)
- [ ] **Privacy Policy**
  - [ ] How data is collected, used, stored
  - [ ] User rights (access, deletion, export)
  - [ ] Data retention periods
  
- [ ] **Terms of Service**
  - [ ] Liability limitations
  - [ ] Usage restrictions
  - [ ] Payment terms
  
- [ ] **Data Handling**
  - [ ] Encrypt NPWP/NIK in database
  - [ ] Right to be forgotten (delete employee data)
  - [ ] Data export (GDPR-style data portability)
  - [ ] Audit logs of who accessed sensitive data

### Security Audit
- [ ] **Third-Party Security Assessment**
  - [ ] Penetration testing
  - [ ] Vulnerability scanning
  - [ ] Code review by external security firm
  - [ ] Fix critical/high severity issues before launch
  
- [ ] **Compliance Certification**
  - [ ] ISO 27001 (Information Security) - future goal
  - [ ] SOC 2 Type II - future goal

---

## 📱 Phase 10: Client Onboarding (Week 4)

### Pilot Program
- [ ] **Select 2-3 Pilot Clients**
  - [ ] Different company sizes (small, medium)
  - [ ] Willing to provide feedback
  - [ ] Real data testing
  
- [ ] **Support During Pilot**
  - [ ] Daily check-ins
  - [ ] Fix bugs in real-time
  - [ ] Train their staff directly
  - [ ] Collect feedback for improvements

### Client Support Infrastructure
- [ ] **Help Desk**
  - [ ] Email support: support@mios.id
  - [ ] Live chat during business hours
  - [ ] Ticketing system (Zendesk or similar)
  - [ ] Target response time: 2 hours
  
- [ ] **Knowledge Base**
  - [ ] Self-service portal
  - [ ] Video tutorials
  - [ ] Searchable FAQ
  
- [ ] **Training Materials**
  - [ ] Company admin training session (2 hours)
  - [ ] Accountant/HR training (3 hours)
  - [ ] Certification or sign-off required

---

## 🎯 Critical Path Timeline

```
Week 1:  Database setup + Authentication + Basic API endpoints
Week 2:  Employee/Company CRUD + Validation + Initial testing
Week 3:  Performance optimization + Reports + Deployment setup
Week 4:  Monitoring + Documentation + Pilot + Launch
```

---

## 🚨 Pre-Launch Checklist (Final)

- [ ] All automated tests passing (>80% coverage)
- [ ] Load test successful (100 concurrent users, <2s response)
- [ ] Security audit completed, critical issues fixed
- [ ] Database backups automated & tested
- [ ] Monitoring & alerting configured
- [ ] Error tracking (Sentry) operational
- [ ] Documentation complete & reviewed
- [ ] Tax lawyer sign-off on calculations
- [ ] Pilot testing complete with 3+ companies
- [ ] Support team trained
- [ ] DNS configured
- [ ] SSL certificate installed
- [ ] Staging environment mirrors production
- [ ] Disaster recovery plan documented & tested

---

## 🎉 Post-Launch (First Month)

- [ ] Monitor error rates (target: <0.1%)
- [ ] Track response times (target: <1s p95)
- [ ] Collect user feedback
- [ ] Weekly security updates
- [ ] Customer support response time tracking
- [ ] Plan for next feature release (batch payroll automation, leave management)

---

## 💰 Infrastructure Cost Estimate (Monthly)

| Component | Cost | Notes |
|-----------|------|-------|
| **AWS** | | |
| EC2 (2x t3.medium for redundancy) | $50 | Backend servers |
| RDS PostgreSQL (db.t3.small) | $30 | Database |
| CloudFront + S3 | $20 | Frontend CDN |
| **Tools** | | |
| Sentry (Error tracking) | $29 | Up to 10k events/month |
| Datadog (APM) | $15 | Minimum tier |
| GitHub Actions | $0 | Free tier for public repos |
| SendGrid (Email) | $20 | 40k emails/month |
| **Domain & SSL** | | |
| Domain name | $12 | .id or .com |
| SSL Certificate | $0 | Let's Encrypt (free) |
| **TOTAL** | ~$175-200/month | For initial 500 users |

*Scales with usage; can use AWS free tier for first 12 months*

---

## 🎓 Knowledge Transfer

- [ ] Document all custom calculations (tax, BPJS)
- [ ] Create decision log for design choices
- [ ] Set up internal Wiki for team
- [ ] Plan for code review process
- [ ] Establish coding standards

---

This checklist ensures **production-grade quality, security, and compliance** for Indonesian payroll processing! 🚀

Start with **Phase 1 & 2** (Backend + Auth) in parallel, then **Phase 3-5** (Validation + Testing), then **Phase 6-10** (Launch prep).
