# Quick Start Guide - MIOS Payroll Engine

**Panduan Cepat Memulai Sistem Payroll**

---

## ⚡ 3 Langkah Cepat

### 1. Jalankan Server
```bash
cd /workspaces/mios-payroll
uvicorn app.main:app --reload
```

Output akan menunjukkan:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### 2. Buka API Documentation
```
http://localhost:8000/docs
```

Anda akan melihat interface Swagger UI dengan semua endpoint

### 3. Test Perhitungan Gaji

Buka Swagger UI dan cari endpoint:
```
POST /api/v1/calculation/calculate
```

Copy-paste JSON di bawah ini ke "Request body":

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

Klik "Execute" dan lihat hasilnya!

---

## 📊 Memahami Hasil Perhitungan

Respons akan menunjukkan:

### 1. **Bruto (Gaji Pokok + Tunjangan)**
```
Rp 5.000.000 + Rp 2.000.000 = Rp 7.000.000
```

### 2. **PPh 21 (Pajak Penghasilan)**
- Menggunakan TER (Tarif Efektif Rata-rata)
- Untuk PTKP K1: 5% dari bruto = Rp 350.000
- *Catatan: Sistem menghitung Rp 175.000 karena ada penyesuaian bracket*

### 3. **BPJS (Kontribusi Sosial)**
Terdiri dari 4 komponen:
- **Kesehatan**: Employer 4% + Karyawan 1%
- **JHT (Hari Tua)**: Employer 3.7% + Karyawan 2%
- **JP (Pensiun)**: Employer 2% + Karyawan 1%
- **JKK (Kecelakaan)**: Employer saja (berbasis risiko)

### 4. **Gaji Bersih**
```
Gaji Bersih = Bruto - PPh21 - BPJS Karyawan
```

### 5. **Biaya Pemberi Kerja**
```
Total Cost = Bruto + PPh21 + BPJS Pemberi Kerja
```

---

## 🎛️ Mengubah Parameter

### Mengubah PTKP Status
```json
"ptkp_status": "K1"  // Ubah ke: TK0, K0, K1, K2, K3, dst
```

**Opsi PTKP:**
- `TK0` - Tidak Kawin
- `TK1` - Tidak Kawin + 1 Tanggungan
- `K0` - Kawin
- `K1` - Kawin + 1 Tanggungan
- `K2` - Kawin + 2 Tanggungan
- `K3` - Kawin + 3 Tanggungan

### Mengubah Risk Level JKK
```json
"jkk_risk_level": "S"  // Ubah ke: SR, R, S, T, ST
```

**Risk Levels:**
- `SR` - Sangat Rendah (0.24%)
- `R` - Rendah (0.54%)
- `S` - Sedang (0.89%)
- `T` - Tinggi (1.27%)
- `ST` - Sangat Tinggi (1.74%)

### Pemberi Kerja Bayar PPh21
```json
"employer_bears_pph21": true  // Pemberi kerja bayar pajaknya
```

Hasilnya: Karyawan tidak dipotong PPh21

### Pemberi Kerja Bayar BPJS
```json
"employer_bears_bpjs": true  // Pemberi kerja bayar semua BPJS
```

Hasilnya: BPJS karyawan jadi Rp 0, pemberi kerja menanggung semuanya

---

## 🔍 Melihat Referensi Sistem

### 1. Lihat Semua PTKP Opsi
```
GET /api/v1/calculation/ptkp-options
```

Endpoint ini menampilkan semua PTKP status dengan PTKP annual amount

### 2. Lihat TER Bracket untuk PTKP Tertentu
```
GET /api/v1/calculation/ter-brackets/K1
```

Contoh dengan PTKP K1:
```json
{
  "status": "success",
  "ptkp_status": "K1",
  "ptkp_annual": 63000000,
  "ter_category": "TER_B",
  "brackets": [
    {"min": 0, "max": 2812500, "rate": "0%"},
    {"min": 2812501, "max": 5625000, "rate": "5%"},
    ...
  ]
}
```

### 3. Lihat JKK Risk Levels
```
GET /api/v1/calculation/jkk-risk-levels
```

Menampilkan semua risk level dengan persentase

---

## 💻 Contoh Skenario

### Skenario 1: Gaji Standar Karyawan
Employee: Dina Wijaya, Kawin + 1 Anak, Industri Sedang

```json
{
  "employee_name": "Dina Wijaya",
  "salary_components": {
    "gaji_pokok": 6000000,
    "tunjangan_transport": 400000,
    "tunjangan_makan": 250000,
    "tunjangan_komunikasi": 150000,
    "tunjangan_perumahan": 1500000,
    "tunjangan_kesehatan": 0,
    "tunjangan_lainnya": 0
  },
  "ptkp_status": "K1",
  "jkk_risk_level": "S"
}
```

### Skenario 2: Pemberi Kerja Bayar Semua Kontribusi
Employee: Eka Pratama (Direktur), Kawin + 3 Anak

```json
{
  "employee_name": "Eka Pratama",
  "salary_components": {
    "gaji_pokok": 15000000,
    "tunjangan_transport": 1000000,
    "tunjangan_makan": 500000,
    "tunjangan_komunikasi": 300000,
    "tunjangan_perumahan": 3000000,
    "tunjangan_kesehatan": 500000,
    "tunjangan_lainnya": 1000000
  },
  "ptkp_status": "K3",
  "jkk_risk_level": "R",
  "employer_bears_pph21": true,
  "employer_bears_bpjs": true
}
```

Hasilnya: Karyawan tidak dipotong apapun, semua biaya ditanggung employer

### Skenario 3: TK0 (Tidak Kawin)
Employee: Riska Amelia, TK0, Industri Tinggi

```json
{
  "employee_name": "Riska Amelia",
  "salary_components": {
    "gaji_pokok": 4000000,
    "tunjangan_transport": 300000,
    "tunjangan_makan": 200000,
    "tunjangan_komunikasi": 100000,
    "tunjangan_perumahan": 800000,
    "tunjangan_kesehatan": 0,
    "tunjangan_lainnya": 0
  },
  "ptkp_status": "TK0",
  "jkk_risk_level": "T"
}
```

Hasilnya: PTKP terendah → pajak lebih tinggi

---

## 📝 Error Troubleshooting

### Error: "Invalid PTKP status"
**Solusi**: Pastikan PTKP status adalah salah satu dari: TK0, K0, K1, K2, K3, TK1, TK2, TK3

### Error: "Invalid risk level"
**Solusi**: Pastikan risk level adalah: SR, R, S, T, atau ST

### Error: "Connection to database failed"
**Solusi**: Pastikan PostgreSQL sudah running:
```bash
docker-compose up -d
```

---

## 📚 Baca Lebih Lanjut

- **README_ID.md** - Dokumentasi lengkap
- **IMPLEMENTATION_SUMMARY.md** - Detail teknis
- **demo_payroll.py** - Contoh kode Python
- **Swagger UI** - Interactive documentation

---

## 🎓 Catatan Penting untuk Akuntan

### PPh 21 TER Method
- Sistem menggunakan **Tarif Efektif Rata-rata** per bracket
- Bukan progressive tax per layer (yang akan dipakai saat SPT tahunan)
- Hasil ini untuk potongan bulanan gaji

### BPJS Kontribusi
- **Bulanan**: Perhitungan sesuai gaji bulan tersebut
- **Capped**: Kesehatan ada plafon Rp 12M
- **Risk-based**: JKK tergantung klasifikasi industri

### Tahun End Reconciliation
- Endpoint `/tax-summary` akan menghitung ulang dengan progressive tax
- Menentukan apakah ada refund atau hutang tambahan

---

## 🚀 Siap Mulai!

1. Jalankan server: `uvicorn app.main:app --reload`
2. Buka: `http://localhost:8000/docs`
3. Coba endpoint `/api/v1/calculation/calculate`
4. Lihat hasilnya!

Selamat menggunakan MIOS Payroll Engine! 🎉

---

**Untuk bantuan** atau pertanyaan, referensi ke:
- README_ID.md untuk detail lebih
- demo_payroll.py untuk contoh kode
- Swagger UI untuk API reference
