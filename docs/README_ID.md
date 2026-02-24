# MIOS Payroll Intelligence Engine

**Sistem Kalkulasi Gaji, PPh 21, dan BPJS untuk Perusahaan Indonesia**

---

## 🎯 Tujuan Sistem

Aplikasi ini menggantikan spreadsheet Excel untuk perhitungan gaji karyawan dengan:

✅ **Kalkulasi Akurat PPh 21** - Menggunakan sistem TER (Tarif Efektif Rata-rata) 2024
✅ **Kontribusi BPJS Lengkap** - Kesehatan, JHT, JP, JKK berbasis risiko
✅ **Konfigurasi Fleksibel** - Tunjangan custom, tanggung jawab pihak ketiga
✅ **Data Terstruktur** - Penyimpanan PostgreSQL untuk audit trail
✅ **Penjelasan Detail** - Breakdown per komponen untuk akuntan
✅ **Multi-Tenant** - Mengelola gaji dari berbagai perusahaan sekaligus

---

## 📋 Fitur Utama

### 1. **Perhitungan Gaji Bulanan**
```
Gaji Pokok + Tunjangan = Bruto Bulanan
         ↓
    (Kalkulasi PPh 21)
         ↓
    (Kalkulasi BPJS)
         ↓
  Gaji Bersih Karyawan
```

Data disimpan dengan presisi Decimal untuk akurasi finansial.

### 2. **Sistem PPh 21 (Pajak Penghasilan)**

#### Metode TER (Tarif Efektif Rata-rata)
- **Bulanan**: Menggunakan bracket TER sesuai PTKP status
- **Tahunan**: Rekonsiliasi dengan progresif tax untuk SPT

#### PTKP Status yang Didukung
- `TK0` - Tidak Kawin (PTKP: Rp 54 juta/tahun)
- `TK1`, `TK2`, `TK3` - Tidak Kawin + Tanggungan
- `K0` - Kawin (PTKP: Rp 58,5 juta/tahun)
- `K1`, `K2`, `K3` - Kawin + Tanggungan

#### Bracket TER (Contoh TER_A)
| Penghasilan Bulanan | Tarif |
|-------------------|-------|
| Rp 0 - Rp 2,325,000 | 0% |
| Rp 2,325,001 - Rp 4,650,000 | 5% |
| Rp 4,650,001 - Rp 9,300,000 | 10% |
| Rp 9,300,001 - Rp 18,600,000 | 15% |
| > Rp 18,600,000 | 20% |

### 3. **Kontribusi BPJS**

#### BPJS Kesehatan
- **Pemberi Kerja**: 4%
- **Karyawan**: 1%
- **Plafon**: Rp 12 juta/bulan

#### BPJS Ketenagakerjaan
**JHT (Jaminan Hari Tua/Pension)**
- **Pemberi Kerja**: 3.7%
- **Karyawan**: 2%

**JP (Jaminan Pensiun)**
- **Pemberi Kerja**: 2%
- **Karyawan**: 1%

**JKK (Jaminan Kecelakaan Kerja) - Berbasis Risiko**
- **SR (Sangat Rendah)**: 0.24%
- **R (Rendah)**: 0.54%
- **S (Sedang)**: 0.89%
- **T (Tinggi)**: 1.27%
- **ST (Sangat Tinggi)**: 1.74%
- **Catatan**: Hanya pemberi kerja yang membayar

### 4. **Komponen Gaji yang Didukung**

```
BRUTO = Gaji Pokok + Tunjangan:
  ├── Tunjangan Transport
  ├── Tunjangan Makan
  ├── Tunjangan Komunikasi
  ├── Tunjangan Perumahan
  ├── Tunjangan Kesehatan
  └── Tunjangan Lainnya
```

### 5. **Konfigurasi Tanggung Jawab Pemberi Kerja**

Sistem mendukung berbagai metode pembayaran gaji:

**Method A - Karyawan Membayar Semua**
```
Net Salary = Bruto - PPh21 - BPJS Karyawan
Employer Cost = Bruto + BPJS Pemberi Kerja
```

**Method B - Pemberi Kerja Bayar PPh21**
```
Net Salary = Bruto (tanpa potong PPh21)
Employer Cost = Bruto + PPh21 + BPJS Pemberi Kerja
```

**Method C - Pemberi Kerja Bayar Semua Kontribusi**
```
Net Salary = Bruto
Employer Cost = Bruto + PPh21 + (BPJS Pemberi Kerja + Karyawan)
```

---

## 🔌 API Endpoints

### 1. **Perhitungan Gaji**

#### POST `/api/v1/calculation/calculate`
**Request:**
```json
{
  "employee_id": "550e8400-e29b-41d4-a716-446655440000",
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "employee_name": "Budi Santoso",
  "salary_components": {
    "gaji_pokok": 5000000,
    "tunjangan_transport": 500000,
    "tunjangan_makan": 300000,
    "tunjangan_komunikasi": 200000,
    "tunjangan_perumahan": 1000000,
    "tunjangan_kesehatan": 0,
    "tunjangan_lainnya": 0
  },
  "ptkp_status": "K1",
  "jkk_risk_level": "S",
  "employer_bears_pph21": false,
  "employer_bears_bpjs": false
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "employee_name": "Budi Santoso",
    "period": "February 2026",
    "bruto_monthly": 7000000,
    "pph21": {
      "employee_portion": 175000,
      "employer_portion": 0,
      "ter_rate": 0.05,
      "ter_category": "TER_B",
      "ptkp_status": "K1"
    },
    "bpjs": {
      "kesehatan": {"employer": 280000, "employee": 70000, "total": 350000},
      "jht": {"employer": 259000, "employee": 140000, "total": 399000},
      "jp": {"employer": 140000, "employee": 70000, "total": 210000},
      "jkk": {"employer": 62230, "employee": 0, "total": 62230, "risk_level": "S"},
      "total_employee": 280000,
      "total_employer": 741230
    },
    "summary": {
      "bruto": 7000000,
      "pph21": 175000,
      "bpjs_total": 1021230,
      "total_deductions_employee": 455000,
      "net_salary": 6545000,
      "total_employer_cost": 7741230
    }
  }
}
```

### 2. **Opsi PTKP**

#### GET `/api/v1/calculation/ptkp-options`
**Response:**
```json
{
  "status": "success",
  "ptkp_options": {
    "TK0": {
      "annual": 54000000,
      "ter_category": "TER_A",
      "description": "Tidak Kawin"
    },
    "K1": {
      "annual": 63000000,
      "ter_category": "TER_B",
      "description": "Kawin + 1 Tanggungan"
    }
  }
}
```

### 3. **Bracket TER**

#### GET `/api/v1/calculation/ter-brackets/{ptkp_status}`
**Response:**
```json
{
  "status": "success",
  "ptkp_status": "K1",
  "ptkp_annual": 63000000,
  "ter_category": "TER_B",
  "brackets": [
    {"min": 0, "max": 2812500, "rate": "0%"},
    {"min": 2812501, "max": 5625000, "rate": "5%"}
  ]
}
```

### 4. **Level Risiko JKK**

#### GET `/api/v1/calculation/jkk-risk-levels`
**Response:**
```json
{
  "status": "success",
  "risk_levels": {
    "SR": "Sangat Rendah (0.24%)",
    "R": "Rendah (0.54%)",
    "S": "Sedang (0.89%)",
    "T": "Tinggi (1.27%)",
    "ST": "Sangat Tinggi (1.74%)"
  }
}
```

---

## 🗄️ Model Basis Data

### Companies
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  npwp VARCHAR,
  created_at TIMESTAMP
);
```

### Employees
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies,
  nama VARCHAR NOT NULL,
  nik VARCHAR NOT NULL,
  npwp VARCHAR,
  status_ptkp VARCHAR NOT NULL,  -- TK0, K1, K3, etc
  jabatan VARCHAR,
  tanggal_masuk DATE
);
```

### Employee Salary Profiles
```sql
CREATE TABLE employee_salary_profiles (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES employees,
  gaji_pokok NUMERIC(18,2),
  tunjangan_transport NUMERIC(18,2),
  tunjangan_makan NUMERIC(18,2),
  jkk_risk_level VARCHAR,  -- SR, R, S, T, ST
  employer_bears_pph21 BOOLEAN,
  employer_bears_bpjs BOOLEAN,
  valid_from TIMESTAMP
);
```

### Payroll Records
```sql
CREATE TABLE payroll_items (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies,
  employee_id UUID REFERENCES employees,
  year INTEGER,
  month INTEGER,
  gross_income NUMERIC(18,2),
  pph21 NUMERIC(18,2),
  bpjs NUMERIC(18,2),
  net_income NUMERIC(18,2),
  created_at TIMESTAMP
);
```

---

## 🚀 Cara Menggunakan

### 1. **Setup Awal**
```bash
# Install dependencies
pip install -r requirements.txt

# Setup database
docker-compose up -d
alembic upgrade head

# Jalankan server
uvicorn app.main:app --reload
```

### 2. **Contoh Perhitungan Gaji**

**Karyawan: Budi Santoso**
- Gaji Pokok: Rp 5.000.000
- Tunjangan Total: Rp 2.000.000
- **Bruto: Rp 7.000.000**
- PTKP Status: K1 (Kawin + 1 Tanggungan)
- Risk Level JKK: Sedang (0.89%)

**Hasil Perhitungan:**

| Komponen | Jumlah |
|----------|--------|
| **Pendapatan** | |
| Gaji Pokok | Rp 5.000.000 |
| Tunjangan Transport | Rp 500.000 |
| Tunjangan Makan | Rp 300.000 |
| Tunjangan Komunikasi | Rp 200.000 |
| Tunjangan Perumahan | Rp 1.000.000 |
| **Total Bruto** | **Rp 7.000.000** |
| | |
| **Potongan Karyawan** | |
| PPh 21 (TER: 5%) | Rp 175.000 |
| BPJS Kesehatan (1%) | Rp 70.000 |
| BPJS JHT (2%) | Rp 140.000 |
| BPJS JP (1%) | Rp 70.000 |
| **Total Potongan** | **Rp 455.000** |
| | |
| **Gaji Bersih** | **Rp 6.545.000** |
| | |
| **Biaya Pemberi Kerja** | |
| BPJS Kesehatan (4%) | Rp 280.000 |
| BPJS JHT (3.7%) | Rp 259.000 |
| BPJS JP (2%) | Rp 140.000 |
| BPJS JKK (0.89%) | Rp 62.230 |
| **Total Biaya Tambahan** | **Rp 741.230** |
| | |
| **Total Biaya Pemberi Kerja** | **Rp 7.741.230** |

---

## 📊 Fitur Laporan (Future)

- [ ] Laporan Gaji Bulanan per Karyawan
- [ ] Laporan BPJS Pengumpulan
- [ ] Laporan Rekonsiliasi PPh 21 Tahunan
- [ ] Dashboard Statistik Gaji
- [ ] Export untuk SPT (Surat Pemberitahuan)
- [ ] Notifikasi Deadline Pelaporan

---

## 🔐 Keamanan & Compliance

✅ Data encryption (PostgreSQL + SSL)
✅ Row-level security (per company)
✅ Audit trail untuk semua perubahan
✅ Backup otomatis
✅ Compliance dengan regulasi PPh 21 dan BPJS
✅ Integrasi potensial dengan DJP dan BPJS

---

## 🛠️ Teknologi yang Digunakan

- **FastAPI** - Web framework
- **SQLAlchemy** - ORM
- **PostgreSQL** - Database
- **Pydantic** - Data validation
- **Python Decimal** - Financial precision

---

## 📚 Referensi Regulasi

- PPh 21 TER 2024 - Direktorat Jenderal Pajak (DJP)
- Peraturan BPJS Kesehatan 2024
- Peraturan BPJS Ketenagakerjaan 2024
- UU No. 8 Tahun 1997 tentang Dokumen Perusahaan

---

## 📞 Support & Kontribusi

Untuk pertanyaan atau request fitur, silakan buka issue di repository ini.

---

**Dikembangkan untuk akuntan Indonesia** ✨
