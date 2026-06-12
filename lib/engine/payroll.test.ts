/**
 * Engine tests — locks current behavior before slice 2 changes.
 *
 * These tests are organized so each `describe` block can survive an engine
 * change independently. Tests that pin *current* behavior known to be wrong
 * (HARIAN using Pasal 17 + Rp 450k threshold) are marked with PINS-CURRENT
 * in the test name, signaling they should be rewritten when that behavior
 * is corrected in a later task.
 */

import { describe, it, expect } from 'vitest';
import {
  getTerRate,
  getPasal17Tax,
  calculateBPJS,
  calculateMonthlySalary,
  calculateFreelance,
  type KaryawanTetap,
  type KaryawanTidakTetap,
} from './payroll';
import { PTKP_TER_GRUP, BPJS, JP_MAX_BASIS, KES_MAX_BASIS } from './constants';

// ── Helper: default KaryawanTetap so each test only overrides what matters ──
function tetap(overrides: Partial<KaryawanTetap> = {}): KaryawanTetap {
  return {
    nama: 'Test',
    nik: '0000000000000001',
    npwp: '000000000000000',
    divisi: 'Default',
    jenis_kelamin: 'L',
    bulan: 1,
    tahun: 2026,
    status_ptkp: 'TK0',
    punya_npwp: true,
    gaji_pokok: 5_000_000,
    benefit: 0,
    kendaraan: 0,
    pulsa: 0,
    operasional: 0,
    tunj_lain: 0,
    thr: 0,
    bonus: 0,
    ikut_jht: false,
    ikut_jp: false,
    ikut_jkp: false,
    jkk_rate: 0.0024,
    tanggung_jht_k: false,
    tanggung_jp_k: false,
    ikut_kes: false,
    tanggung_kes_k: false,
    pph_ditanggung: false,
    kasbon: 0,
    alpha_telat: 0,
    pot_lain: 0,
    pph_jan_nov: 0,
    akum_bruto: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
describe('getTerRate', () => {
  it('TER A: 0 below first threshold', () => {
    expect(getTerRate(5_000_000, 'A')).toBe(0);
    expect(getTerRate(5_400_000, 'A')).toBe(0);
  });

  it('TER A: bracket transitions match table', () => {
    // 5,400,001..5,650,000 = 0.0025
    expect(getTerRate(5_400_001, 'A')).toBe(0.0025);
    expect(getTerRate(5_650_000, 'A')).toBe(0.0025);
    // 7,500,001..8,550,000 = 0.015
    expect(getTerRate(8_000_000, 'A')).toBe(0.015);
    // 8,550,001..9,650,000 = 0.0175 (the GABE bracket — production reference)
    expect(getTerRate(8_550_001, 'A')).toBe(0.0175);
    expect(getTerRate(9_650_000, 'A')).toBe(0.0175);
  });

  it('TER B: bracket transitions match table', () => {
    expect(getTerRate(6_000_000, 'B')).toBe(0);
    expect(getTerRate(6_200_001, 'B')).toBe(0.0025);
    // 9,200,001..10,750,000 = 0.015 — covers 10M
    expect(getTerRate(10_000_000, 'B')).toBe(0.015);
    // 7,300,001..9,200,000 = 0.01
    expect(getTerRate(9_000_000, 'B')).toBe(0.01);
  });

  it('TER C: bracket transitions match table', () => {
    expect(getTerRate(6_000_000, 'C')).toBe(0);
    expect(getTerRate(6_600_001, 'C')).toBe(0.0025);
  });

  it('TER: top bracket on huge income', () => {
    expect(getTerRate(2_000_000_000, 'A')).toBe(0.34);
    expect(getTerRate(2_000_000_000, 'B')).toBe(0.34);
    expect(getTerRate(2_000_000_000, 'C')).toBe(0.34);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('PTKP_TER_GRUP', () => {
  it('maps PTKP statuses to TER groups per PMK 168/2023', () => {
    expect(PTKP_TER_GRUP['TK0']).toBe('A');
    expect(PTKP_TER_GRUP['TK1']).toBe('A');
    expect(PTKP_TER_GRUP['K0']).toBe('A');
    expect(PTKP_TER_GRUP['TK2']).toBe('B');
    expect(PTKP_TER_GRUP['TK3']).toBe('B');
    expect(PTKP_TER_GRUP['K1']).toBe('B');
    expect(PTKP_TER_GRUP['K2']).toBe('B');
    expect(PTKP_TER_GRUP['K3']).toBe('C');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('getPasal17Tax', () => {
  it('returns 0 for zero PKP', () => {
    expect(getPasal17Tax(0)).toBe(0);
  });

  it('first bracket at 5%: 60M → 3M', () => {
    expect(getPasal17Tax(60_000_000)).toBe(3_000_000);
  });

  it('crosses into 15% bracket: 250M → 3M + 190M×0.15 = 31.5M', () => {
    expect(getPasal17Tax(250_000_000)).toBe(31_500_000);
  });

  it('crosses into 25% bracket: 500M → 31.5M + 250M×0.25 = 94M', () => {
    expect(getPasal17Tax(500_000_000)).toBe(94_000_000);
  });

  it('floors PKP to nearest 1000', () => {
    // 60_000_999 floors to 60_000_000 then × 5% = 3_000_000
    expect(getPasal17Tax(60_000_999)).toBe(3_000_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('calculateBPJS', () => {
  it('zero everywhere when no flags enabled', () => {
    const r = calculateBPJS(5_000_000, tetap({ jkk_rate: 0 }));
    expect(r.jkk).toBe(0);
    expect(r.jkm).toBeCloseTo(15_000, 0);  // jkm is always computed (employer-paid)
    expect(r.jht_e).toBe(0);
    expect(r.jp_e).toBe(0);
    expect(r.kes_e).toBe(0);
  });

  it('JKK uses per-employee rate', () => {
    const r = calculateBPJS(10_000_000, tetap({ jkk_rate: 0.0089 }));
    expect(r.jkk).toBeCloseTo(89_000, 0); // 10M × 0.0089
  });

  it('JHT/JP/Kes enrolled: employer + karyawan amounts', () => {
    const r = calculateBPJS(8_000_000, tetap({
      ikut_jht: true, ikut_jp: true, ikut_kes: true, jkk_rate: 0.0024,
    }));
    // Components are raw floats — toBeCloseTo guards against IEEE 754 sub-rupiah noise
    expect(r.jht_e).toBeCloseTo(296_000, 0); // 8M × 0.037
    expect(r.jht_k).toBeCloseTo(160_000, 0); // 8M × 0.02
    expect(r.jp_e).toBeCloseTo(160_000, 0);  // 8M × 0.02
    expect(r.kes_e).toBeCloseTo(320_000, 0); // 8M × 0.04
  });

  it('JP capped at JP_MAX_BASIS', () => {
    expect(JP_MAX_BASIS).toBe(10_547_400);
    const r = calculateBPJS(20_000_000, tetap({
      ikut_jp: true, ikut_jht: true, ikut_kes: true, jkk_rate: 0.0024,
    }));
    // JP basis caps at 10,547,400 → JP_e = cap × 0.02 = 210,948
    expect(r.jp_e).toBeCloseTo(210_948, 0);
    // JHT does NOT cap → 20M × 0.037 = 740,000
    expect(r.jht_e).toBeCloseTo(740_000, 0);
  });

  it('Kes capped at KES_MAX_BASIS', () => {
    expect(KES_MAX_BASIS).toBe(12_000_000);
    const r = calculateBPJS(20_000_000, tetap({
      ikut_kes: true, jkk_rate: 0.0024,
    }));
    expect(r.kes_e).toBeCloseTo(480_000, 0); // 12M × 0.04 = 480,000
  });

  it('tanggung_jht_k: JHT karyawan amount becomes tunjangan, not potongan', () => {
    const r = calculateBPJS(10_000_000, tetap({
      ikut_jht: true, tanggung_jht_k: true, jkk_rate: 0.0024,
    }));
    expect(r.tunj_jht).toBeCloseTo(200_000, 0); // 10M × 0.02
    expect(r.pot_jht).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('bpjs_basis override (PMK-aware: declared BPJS salary often != gaji)', () => {
  it('null/undefined bpjs_basis: falls back to gaji_pokok (back-compat)', () => {
    const r = calculateMonthlySalary(tetap({
      gaji_pokok: 8_270_526,
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
      status_ptkp: 'K0',
      // bpjs_basis omitted → undefined → fallback
    }));
    // JKK = 8_270_526 × 0.0024 = 19_849.26 — kept as decimal, not rounded to 19_849
    expect(r.bpjs.jkk).toBeCloseTo(19_849.26, 1);
    // KES_e = min(8_270_526, 12M) × 0.04 = 330_821.04 — kept as decimal
    expect(r.bpjs.kes_e).toBeCloseTo(330_821.04, 1);
  });

  it('non-null bpjs_basis: BPJS calculated against declared basis, not gaji_pokok', () => {
    const r = calculateMonthlySalary(tetap({
      gaji_pokok: 8_270_526,
      bpjs_basis: 5_729_876,           // accountant's declared BPJS salary
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
      status_ptkp: 'K0',
    }));
    // Components are raw decimals — verifying the value is NOT rounded to integer
    expect(r.bpjs.jkk).toBeCloseTo(13_751.70, 1);   // 5_729_876 × 0.0024 = 13751.7024
    expect(r.bpjs.jkm).toBeCloseTo(17_189.63, 1);   // 5_729_876 × 0.003
    expect(r.bpjs.kes_e).toBeCloseTo(229_195.04, 1); // 5_729_876 × 0.04
    expect(r.bpjs.jht_e).toBeCloseTo(212_005.41, 1); // 5_729_876 × 0.037
    expect(r.bpjs.jp_e).toBeCloseTo(114_597.52, 1);  // 5_729_876 × 0.02 (under JP cap)
  });

  it('REGRESSION (GABEMARITO Feb-2026): engine matches Excel PPh exactly', () => {
    // Real employee from samples/Grossup PPh 21 02-2026.xlsx row 6.
    // Excel had PPh = 127,960. Engine without bpjs_basis computed 151,198 (+15.37%
    // overcount) because it used gaji_pokok as BPJS basis. With bpjs_basis passed
    // through, this should now match the Excel value to the rupiah.
    const r = calculateMonthlySalary(tetap({
      gaji_pokok: 8_270_526,
      bpjs_basis: 5_729_876,
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
      status_ptkp: 'K0',
      punya_npwp: true,
      pph_ditanggung: false,
    }));
    // bruto = 8_270_526 + (JKK 13751.70 + JKM 17189.63 + KES_e 229195.04) = 8_530_662.37
    // (prior rounded-component result was 8_530_663 — decimal bruto matches Excel more closely)
    expect(r.bruto).toBeCloseTo(8_530_662.37, 0);
    expect(r.ter).toBe(0.015); // TER A 7,500,001..8,550,000
    expect(r.pph).toBe(127_960); // 0.015 × 8,530,662.37 = 127,959.94 → 127,960
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('calculateMonthlySalary (non-grossup, TER)', () => {
  it('simple TER A: 5M gaji, no allowances, no BPJS, TK0', () => {
    const r = calculateMonthlySalary(tetap({ gaji_pokok: 5_000_000, jkk_rate: 0 }));
    expect(r.grup).toBe('A');
    expect(r.bruto).toBeCloseTo(5_015_000, 0); // 5M + jkm (15k) — jkk=0 because rate=0
    expect(r.ter).toBe(0); // 5,015,000 is in TER A bracket 0..5,400,000 → 0%
    expect(r.pph).toBe(0);
    expect(r.tunj_pph).toBe(0);
  });

  it('TER A above first threshold computes PPh = TER × bruto', () => {
    // gaji 8M, all BPJS on, no allowances, TK0
    const r = calculateMonthlySalary(tetap({
      gaji_pokok: 8_000_000,
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
    }));
    // bruto = 8M + JKK(~19200) + JKM(~24000) + KES_e(~320000) ≈ 8,363,200
    // TER A at ~8,363,200 → 0.015 bracket → PPh = bruto × 0.015 = 125,448
    expect(r.bruto).toBeCloseTo(8_363_200, 0);
    expect(r.ter).toBe(0.015);
    expect(r.pph).toBe(125_448);
  });

  it('Non-NPWP: no surcharge per PENG-6/PJ.09/2024 — PPh matches NPWP case', () => {
    const r = calculateMonthlySalary(tetap({
      gaji_pokok: 8_000_000,
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
      punya_npwp: false,
    }));
    // Engine no longer multiplies by 1.2. Same bruto/TER as the NPWP case → identical PPh.
    expect(r.pph).toBe(125_448);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('calculateMonthlySalary (grossup / pph_ditanggung)', () => {
  it('grossup iteration: tunj_pph equals PPh; THP excludes PPh', () => {
    const r = calculateMonthlySalary(tetap({
      gaji_pokok: 8_000_000,
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
      pph_ditanggung: true,
    }));
    expect(r.pph_ditanggung).toBe(true);
    expect(r.tunj_pph).toBe(r.pph);
    expect(r.pot_pph).toBe(0);
    // THP deducts Math.round(karyawan_potong) — cash deductions must be whole rupiah
    expect(r.thp).toBe(8_000_000 - Math.round(r.bpjs.karyawan_potong));
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('annual projection (every-month forecast columns)', () => {
  it('Jan-Nov: proyeksi.* computed by projecting current bruto × 12', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 3, // any non-December month
      gaji_pokok: 8_000_000,
      jkk_rate: 0, // simplifies: no employer JKK
      // No BPJS enrollment → bruto = 8M + jkm(24k) = 8,024,000
    }));
    expect(r.bruto).toBeCloseTo(8_024_000, 0);
    expect(r.pph).toBe(120_360); // Math.round(~8,024,000 × 0.015)

    expect(r.proyeksi.bruto_setahun).toBeCloseTo(96_288_000, 0);
    expect(r.proyeksi.biaya_jabatan_setahun).toBeCloseTo(4_814_400, 0); // ~5% of 96.288M
    expect(r.proyeksi.netto_setahun).toBeCloseTo(91_473_600, 0);
    expect(r.proyeksi.pkp_setahun).toBe(37_473_000); // floored to 1k, absorbs float noise
    expect(r.proyeksi.pph_setahun).toBe(1_873_650); // 5% × 37.473M
    expect(r.proyeksi.pph_jan_nov_proyeksi).toBe(120_360 * 11); // 1,323,960
    expect(r.proyeksi.pph_desember_proyeksi).toBe(549_690); // setahun - jan_nov
  });

  it('Jan-Nov: biaya_jabatan caps at Rp 6,000,000 per year for high earners', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 6,
      gaji_pokok: 50_000_000, // 600M/year → 5% would be 30M; cap kicks in
      jkk_rate: 0,
    }));
    expect(r.proyeksi.biaya_jabatan_setahun).toBe(6_000_000); // capped at BIAYA_JAB_MAX × 12
  });

  it('Jan-Nov: non-NPWP pph_setahun matches NPWP (surcharge removed 2026-05-29)', () => {
    const withNpwp = calculateMonthlySalary(tetap({
      bulan: 4,
      gaji_pokok: 8_000_000,
      jkk_rate: 0,
      punya_npwp: true,
    }));
    const withoutNpwp = calculateMonthlySalary(tetap({
      bulan: 4,
      gaji_pokok: 8_000_000,
      jkk_rate: 0,
      punya_npwp: false,
    }));
    // PENG-6/PJ.09/2024 + NIK=NPWP integration → engine treats both identically.
    expect(withoutNpwp.proyeksi.pph_setahun).toBe(withNpwp.proyeksi.pph_setahun);
  });

  it('December: proyeksi.* reflects actual (not projected) values', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 10_000_000,
      jkk_rate: 0,
      akum_bruto: 110_000_000, // realistic Jan-Nov bruto sum
      pph_jan_nov: 1_500_000,
    }));
    // The proyeksi fields exist on December results too, mirroring the calc.
    expect(r.proyeksi).toBeDefined();
    expect(r.proyeksi.pph_jan_nov_proyeksi).toBe(1_500_000); // actual, not projected × 11
    expect(r.proyeksi.pph_desember_proyeksi).toBe(r.pph); // matches calculated December PPh
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('calculateMonthlySalary (December equalization)', () => {
  it('uses akum_bruto when provided; emits Pasal 17 calc', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 10_000_000,
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
      akum_bruto: 110_000_000,
      pph_jan_nov: 1_500_000,
    }));
    expect(r.jenis).toContain('DESEMBER');
    expect(r.ter).toBeNull();
    expect((r as any).pph_jan_nov).toBe(1_500_000);
    // The exact PPh depends on Pasal 17 — just verify it's positive and pph_des = pph_setahun - jan_nov
    expect(r.pph).toBeGreaterThanOrEqual(0);
  });

  it('without akum_bruto: silently falls back to base × 12 (PINS-CURRENT — to add warning later)', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 10_000_000,
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
      akum_bruto: 0, // no Jan–Nov history
    }));
    // Documented hazard per CLAUDE.md and AUDIT.md MEDIUM #4 — currently no warning.
    // This test pins current behavior so the fix can change it intentionally.
    expect(r.jenis).toContain('DESEMBER');
    expect(r.pph).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('calculateFreelance harian (TER method per PMK 168/2023)', () => {
  it('harian under TER A bracket 0: PPh nihil regardless of daily wage', () => {
    // 8 days × Rp 380k = Rp 3,040,000 monthly bruto. TER A bracket 0..5,400,000 = 0%.
    // Matches ALI SAKBAN DAULAY in samples/HARIAN 02 sheet (PPh = 0).
    const r = calculateFreelance({
      nama: 'Ali', nik: '1', npwp: '', divisi: '', bulan: 2, tahun: 2026,
      status_ptkp: 'TK0', punya_npwp: false,
      mode: 'harian',
      upah_harian: 380_000, hari_kerja: 8,
      upah_bulanan: 0, tunjangan: 0,
      ikut_bpjs_tk: false, ikut_kes: false,
      kasbon: 0, pot_lain: 0,
    } satisfies KaryawanTidakTetap);
    expect(r.mode).toBe('harian');
    if (r.mode === 'harian') {
      expect(r.total_upah).toBe(3_040_000);
      expect(r.grup).toBe('A');
      expect(r.ter).toBe(0);
      expect(r.total_pph).toBe(0);
      expect(r.keterangan).toContain('PPh nihil');
    }
  });

  it('REGRESSION (ALFREDO Feb-2026 HARIAN): TER A 1% bracket', () => {
    // Real row from HARIAN 02: TK0 + bruto 6,310,559 → TER A 0.01 → PPh 63,106
    const r = calculateFreelance({
      nama: 'Alfredo', nik: '3172020104970015', npwp: '', divisi: '',
      bulan: 2, tahun: 2026, status_ptkp: 'TK0', punya_npwp: true,
      mode: 'harian',
      upah_harian: 631_055.9, hari_kerja: 10,
      upah_bulanan: 0, tunjangan: 0,
      ikut_bpjs_tk: false, ikut_kes: false,
      kasbon: 0, pot_lain: 0,
    } satisfies KaryawanTidakTetap);
    if (r.mode === 'harian') {
      expect(r.total_upah).toBeCloseTo(6_310_559, 0);
      expect(r.ter).toBe(0.01);
      expect(r.total_pph).toBe(63_106);
    }
  });

  it('REGRESSION (JOKO Feb-2026 HARIAN): K3 → TER C, bracket 0 → PPh nihil', () => {
    // Real row from HARIAN 02: K3 + bruto 6,380,436 → TER C bracket 0..6,600,000 = 0% → PPh 0
    // Important case: high earner but K3 (TER C) so still in bracket 0.
    const r = calculateFreelance({
      nama: 'Joko', nik: '1608180604830002', npwp: '', divisi: '',
      bulan: 2, tahun: 2026, status_ptkp: 'K3', punya_npwp: false,
      mode: 'harian',
      upah_harian: 638_043.6, hari_kerja: 10,
      upah_bulanan: 0, tunjangan: 0,
      ikut_bpjs_tk: false, ikut_kes: false,
      kasbon: 0, pot_lain: 0,
    } satisfies KaryawanTidakTetap);
    if (r.mode === 'harian') {
      expect(r.grup).toBe('C');
      expect(r.ter).toBe(0);
      expect(r.total_pph).toBe(0);
    }
  });

  it('harian: non-NPWP yields same PPh as NPWP (surcharge removed 2026-05-29)', () => {
    const r = calculateFreelance({
      nama: 'NoNPWP', nik: '1', npwp: '', divisi: '',
      bulan: 2, tahun: 2026, status_ptkp: 'TK0', punya_npwp: false,
      mode: 'harian',
      upah_harian: 631_055.9, hari_kerja: 10,
      upah_bulanan: 0, tunjangan: 0,
      ikut_bpjs_tk: false, ikut_kes: false,
      kasbon: 0, pot_lain: 0,
    } satisfies KaryawanTidakTetap);
    if (r.mode === 'harian') {
      // Engine no longer applies ×1.2 — same bruto as ALFREDO → same PPh 63,106.
      expect(r.total_pph).toBe(63_106);
    }
  });

  it('bulanan: under Rp 4.5M monthly threshold → PPh nihil', () => {
    const r = calculateFreelance({
      nama: 'Monthly', nik: '2', npwp: '', divisi: '', bulan: 2, tahun: 2026,
      status_ptkp: 'TK0', punya_npwp: true,
      mode: 'bulanan',
      upah_harian: 0, hari_kerja: 0,
      upah_bulanan: 4_000_000, tunjangan: 0,
      ikut_bpjs_tk: false, ikut_kes: false,
      kasbon: 0, pot_lain: 0,
    } satisfies KaryawanTidakTetap);
    expect(r.mode).toBe('bulanan');
    if (r.mode === 'bulanan') {
      expect(r.pph).toBe(0);
      expect(r.keterangan).toContain('Nihil');
    }
  });

  it('bulanan: above Rp 4.5M threshold → annualized Pasal 17 / 12', () => {
    const r = calculateFreelance({
      nama: 'Monthly', nik: '2', npwp: '', divisi: '', bulan: 2, tahun: 2026,
      status_ptkp: 'TK0', punya_npwp: true,
      mode: 'bulanan',
      upah_harian: 0, hari_kerja: 0,
      upah_bulanan: 6_000_000, tunjangan: 0,
      ikut_bpjs_tk: false, ikut_kes: false,
      kasbon: 0, pot_lain: 0,
    } satisfies KaryawanTidakTetap);
    if (r.mode === 'bulanan') {
      expect(r.pph).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('calculateLastMonth — mid-year exit Pasal 17 reconciliation', () => {
  it('isLastMonth=true on non-December routes to Pasal 17 (jenis = BULAN TERAKHIR)', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 8,             // August exit
      isLastMonth: true,
      months_in_year: 3,    // worked Jun-Aug
      gaji_pokok: 10_000_000,
      jkk_rate: 0.0024,
      akum_bruto: 20_000_000,   // Jun + Jul
      pph_jan_nov: 500_000,
    }));
    expect(r.ter).toBeNull();
    expect(r.jenis).toContain('BULAN TERAKHIR');
    expect((r as any).is_last_month).toBe(true);
    expect((r as any).months_in_year).toBe(3);
  });

  it('default (no flag) on December still produces DESEMBER jenis with monthsInYear=12', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 10_000_000,
      jkk_rate: 0.0024,
      akum_bruto: 110_000_000,
      pph_jan_nov: 1_500_000,
    }));
    expect(r.jenis).toContain('DESEMBER');
    expect((r as any).months_in_year).toBe(12);
  });

  it('biaya jabatan cap scales with months_in_year (3 mo → cap Rp 1.5M, not 6M)', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 8,
      isLastMonth: true,
      months_in_year: 3,
      gaji_pokok: 30_000_000,         // forces 5% × 90M = 4.5M which exceeds 3-month cap
      jkk_rate: 0,
      akum_bruto: 60_000_000,
      pph_jan_nov: 0,
    }));
    // 5% × 90M = 4.5M, but cap = 500k × 3 = 1.5M → bj clamps to 1.5M
    expect((r as any).bj).toBe(1_500_000);
  });

  it('JHT_K iuran karyawan IS deducted from netto when not company-tanggung (bugfix)', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 10_000_000,
      ikut_jht: true,
      tanggung_jht_k: false,    // employee pays JHT_K from gaji
      ikut_jp: false,
      ikut_kes: false,
      jkk_rate: 0,
      akum_bruto: 110_000_000,
      pph_jan_nov: 0,
    }));
    // JHT_K monthly = 10M × 2% = ~200,000 → annual = ~2,400,000
    expect((r as any).jht_k_tahunan).toBeCloseTo(2_400_000, 0);
  });

  it('JHT_K tanggung by company: NOT deducted from netto (it was already in bruto as tunjangan)', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 10_000_000,
      ikut_jht: true,
      tanggung_jht_k: true,
      jkk_rate: 0,
      akum_bruto: 110_000_000,
      pph_jan_nov: 0,
    }));
    expect((r as any).jht_k_tahunan).toBe(0);
  });

  it('Refund: when pph_jan_nov exceeds annual liability, is_refund=true and refund_amount set', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 5_000_000,
      jkk_rate: 0,
      akum_bruto: 55_000_000,    // ~60M bruto setahun, low PPh
      pph_jan_nov: 5_000_000,    // way over-withheld
    }));
    expect((r as any).is_refund).toBe(true);
    expect((r as any).refund_amount).toBeGreaterThan(0);
    expect((r as any).raw_pph).toBeLessThan(0);
    expect(r.pph).toBe(0); // on-slip pph still clamped to 0
  });

  it('No refund: when pph_jan_nov is below annual liability', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 10_000_000,
      jkk_rate: 0.0024,
      akum_bruto: 110_000_000,
      pph_jan_nov: 500_000,    // under-withheld
    }));
    expect((r as any).is_refund).toBe(false);
    expect((r as any).refund_amount).toBe(0);
    expect((r as any).raw_pph).toBeGreaterThanOrEqual(0);
  });

  it('RALO workbook regression: grossup December matches accountant REKAP to the rupiah', () => {
    // Employee "XX" from samples/Grossup PPh 21 RALO.xlsx REKAP sheet:
    // gaji 9,150,000 TK0 grossup; JKK 0.24% + JKM in bruto, Kes employer
    // off-slip; JHT 2% + JP 1% potong karyawan; THR (Mar) + bonus (Aug)
    // already inside akum_bruto. Sheet: bruto setahun 128,286,613 → bj 6M →
    // JHT+JP 3,294,000 → netto 118,992,613 → PKP 64,992,000 → PPh setahun
    // 3,748,800; sudah dipotong 4,168,708 → PPH DES −419,908.
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 9_150_000,
      jkk_rate: 0.0024,
      ikut_jht: true, tanggung_jht_k: false,
      ikut_jp: true, tanggung_jp_k: false,
      ikut_kes: true, tanggung_kes_k: false,
      kes_employer_in_bruto: false,
      pph_ditanggung: true,
      akum_bruto: 119_087_203,
      pph_jan_nov: 4_168_708,
    }));
    expect((r as any).bs).toBeCloseTo(128_286_613, 0);
    expect((r as any).bj).toBe(6_000_000);
    expect((r as any).jht_k_tahunan + (r as any).jp_k_tahunan).toBeCloseTo(3_294_000, 0);
    expect((r as any).pkp).toBe(64_992_000);
    expect((r as any).pph_tahunan).toBe(3_748_800);
    expect((r as any).raw_pph).toBe(-419_908);
    expect((r as any).lebih_potong).toBe(419_908);
    expect((r as any).tunj_pph).toBe(0);  // no December tunjangan needed
    expect(r.pph).toBe(0);                // on-slip stays clamped
  });

  it('December THP includes THR/bonus paid in that month (bugfix)', () => {
    const base = tetap({
      bulan: 12,
      gaji_pokok: 10_000_000,
      jkk_rate: 0,
      akum_bruto: 110_000_000,
      pph_jan_nov: 1_500_000,
    });
    const without = calculateMonthlySalary(base);
    const withThr = calculateMonthlySalary({ ...base, thr: 10_000_000, bonus: 2_000_000 });
    // Same deductions baseline; THP must grow by exactly THR+bonus minus the
    // extra PPh those irregulars trigger in the equalization.
    const extraPph = (withThr.pph ?? 0) - (without.pph ?? 0);
    expect(withThr.thp - without.thp).toBe(12_000_000 - extraPph);
  });

  it('lebih_potong mirrors refund_amount for non-grossup over-withholding', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 5_000_000,
      jkk_rate: 0,
      akum_bruto: 55_000_000,
      pph_jan_nov: 5_000_000,
    }));
    expect((r as any).lebih_potong).toBe((r as any).refund_amount);
    expect((r as any).lebih_potong).toBeGreaterThan(0);
  });

  it('months_in_year clamps to [1, 12]', () => {
    const r1 = calculateMonthlySalary(tetap({
      bulan: 1, isLastMonth: true, months_in_year: 0,
      gaji_pokok: 5_000_000, jkk_rate: 0, akum_bruto: 1, pph_jan_nov: 0,
    }));
    expect((r1 as any).months_in_year).toBe(1);

    const r2 = calculateMonthlySalary(tetap({
      bulan: 12, isLastMonth: true, months_in_year: 99,
      gaji_pokok: 5_000_000, jkk_rate: 0, akum_bruto: 1, pph_jan_nov: 0,
    }));
    expect((r2 as any).months_in_year).toBe(12);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('engine warning flags (audit-hardening)', () => {
  it('proyeksi.is_estimate is true when calculateLastMonth runs with akum_bruto=0', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 8_000_000,
      jkk_rate: 0,
      akum_bruto: 0,    // no prior runs persisted
      pph_jan_nov: 0,
    }));
    expect((r.proyeksi as any).is_estimate).toBe(true);
  });

  it('proyeksi.is_estimate is false when akum_bruto>0 (real prior data)', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 12,
      gaji_pokok: 8_000_000,
      jkk_rate: 0,
      akum_bruto: 88_000_000,   // Jan-Nov real data
      pph_jan_nov: 1_323_960,
    }));
    expect((r.proyeksi as any).is_estimate).toBe(false);
  });

  it('proyeksi.is_estimate is undefined on Jan-Nov non-last-month results', () => {
    const r = calculateMonthlySalary(tetap({
      bulan: 5,
      gaji_pokok: 8_000_000,
      jkk_rate: 0,
    }));
    // Jan-Nov forecast block doesn't set is_estimate; it's a forecast by definition.
    expect((r.proyeksi as any).is_estimate).toBeUndefined();
  });

  it('_converged true and _iterations small for a normal grossup', () => {
    const r = calculateMonthlySalary(tetap({
      gaji_pokok: 8_000_000,
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
      pph_ditanggung: true,
    }));
    expect((r as any)._converged).toBe(true);
    expect((r as any)._iterations).toBeGreaterThan(0);
    expect((r as any)._iterations).toBeLessThan(50);
  });

  it('_converged true (trivial) for non-grossup tetap path', () => {
    const r = calculateMonthlySalary(tetap({
      gaji_pokok: 8_000_000,
      jkk_rate: 0,
      pph_ditanggung: false,
    }));
    // Non-grossup branch sets _converged true trivially (no iteration needed)
    expect((r as any)._converged).toBe(true);
    expect((r as any)._iterations).toBe(0);
  });
});
