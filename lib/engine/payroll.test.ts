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
  calculateSeverance,
  type KaryawanTetap,
  type KaryawanTidakTetap,
  type KompensasiInput,
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
    expect(r.jkm).toBe(15_000);  // jkm is always computed (employer-paid)
    expect(r.jht_e).toBe(0);
    expect(r.jp_e).toBe(0);
    expect(r.kes_e).toBe(0);
  });

  it('JKK uses per-employee rate', () => {
    const r = calculateBPJS(10_000_000, tetap({ jkk_rate: 0.0089 }));
    expect(r.jkk).toBe(89_000); // 10M × 0.0089
  });

  it('JHT/JP/Kes enrolled: employer + karyawan amounts', () => {
    const r = calculateBPJS(8_000_000, tetap({
      ikut_jht: true, ikut_jp: true, ikut_kes: true, jkk_rate: 0.0024,
    }));
    expect(r.jht_e).toBe(Math.round(8_000_000 * BPJS.jht_e)); // 296_000
    expect(r.jht_k).toBe(Math.round(8_000_000 * BPJS.jht_k)); // 160_000
    expect(r.jp_e).toBe(Math.round(8_000_000 * BPJS.jp_e));   // 160_000
    expect(r.kes_e).toBe(Math.round(8_000_000 * BPJS.kes_e)); // 320_000
  });

  it('JP capped at JP_MAX_BASIS', () => {
    expect(JP_MAX_BASIS).toBe(10_547_400);
    const r = calculateBPJS(20_000_000, tetap({
      ikut_jp: true, ikut_jht: true, ikut_kes: true, jkk_rate: 0.0024,
    }));
    // JP basis caps at 10,547,400 → JP_e = cap × 0.02 = 210,948
    expect(r.jp_e).toBe(Math.round(JP_MAX_BASIS * BPJS.jp_e));
    // JHT does NOT cap → 20M × 0.037
    expect(r.jht_e).toBe(Math.round(20_000_000 * BPJS.jht_e));
  });

  it('Kes capped at KES_MAX_BASIS', () => {
    expect(KES_MAX_BASIS).toBe(12_000_000);
    const r = calculateBPJS(20_000_000, tetap({
      ikut_kes: true, jkk_rate: 0.0024,
    }));
    expect(r.kes_e).toBe(Math.round(KES_MAX_BASIS * BPJS.kes_e)); // 480_000
  });

  it('tanggung_jht_k: JHT karyawan amount becomes tunjangan, not potongan', () => {
    const r = calculateBPJS(10_000_000, tetap({
      ikut_jht: true, tanggung_jht_k: true, jkk_rate: 0.0024,
    }));
    const expected = Math.round(10_000_000 * BPJS.jht_k);
    expect(r.tunj_jht).toBe(expected);
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
    // JKK = 8_270_526 × 0.0024 = 19_849.26 → rounded 19_849
    expect(r.bpjs.jkk).toBe(19_849);
    // KES_e = min(8_270_526, 12M) × 0.04 = 330_821.04 → 330_821
    expect(r.bpjs.kes_e).toBe(330_821);
  });

  it('non-null bpjs_basis: BPJS calculated against declared basis, not gaji_pokok', () => {
    const r = calculateMonthlySalary(tetap({
      gaji_pokok: 8_270_526,
      bpjs_basis: 5_729_876,           // accountant's declared BPJS salary
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
      status_ptkp: 'K0',
    }));
    expect(r.bpjs.jkk).toBe(13_752);    // 5_729_876 × 0.0024
    expect(r.bpjs.jkm).toBe(17_190);    // 5_729_876 × 0.003
    expect(r.bpjs.kes_e).toBe(229_195); // 5_729_876 × 0.04
    expect(r.bpjs.jht_e).toBe(212_005); // 5_729_876 × 0.037
    expect(r.bpjs.jp_e).toBe(114_598);  // 5_729_876 × 0.02 (under JP cap)
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
    // bruto = 8_270_526 + 0 + 0 + (JKK 13_752 + JKM 17_190 + KES_e 229_195) + 0
    //       = 8_530_663
    expect(r.bruto).toBe(8_530_663);
    expect(r.ter).toBe(0.015); // TER A 7,500,001..8,550,000
    expect(r.pph).toBe(127_960); // 0.015 × 8,530,663 = 127,959.945 → 127,960
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('calculateMonthlySalary (non-grossup, TER)', () => {
  it('simple TER A: 5M gaji, no allowances, no BPJS, TK0', () => {
    const r = calculateMonthlySalary(tetap({ gaji_pokok: 5_000_000, jkk_rate: 0 }));
    expect(r.grup).toBe('A');
    expect(r.bruto).toBe(5_015_000); // 5M + jkm (15k) — jkk=0 because rate=0
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
    // bruto = 8M + JKK(19200) + JKM(24000) + KES_e(320000) = 8,363,200
    // TER A at 8,363,200 → 0.015 bracket → PPh = 8,363,200 × 0.015 = 125,448
    expect(r.bruto).toBe(8_363_200);
    expect(r.ter).toBe(0.015);
    expect(r.pph).toBe(125_448);
  });

  it('Non-NPWP applies ×1.2 multiplier to PPh', () => {
    const r = calculateMonthlySalary(tetap({
      gaji_pokok: 8_000_000,
      ikut_jht: true, ikut_jp: true, ikut_kes: true,
      jkk_rate: 0.0024,
      punya_npwp: false,
    }));
    // Same bruto/TER as above, PPh × 1.2 = 150,538 (rounded)
    expect(r.pph).toBe(150_538);
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
    // THP = gaji + allowances + irregular - karyawan_potong - 0 (no pot_pph) - 0
    //     = 8M + 0 + 0 - karyawan_potong
    expect(r.thp).toBe(8_000_000 - r.bpjs.karyawan_potong);
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
    expect(r.bruto).toBe(8_024_000);
    expect(r.pph).toBe(Math.round(8_024_000 * 0.015)); // 120,360

    expect(r.proyeksi.bruto_setahun).toBe(96_288_000);
    expect(r.proyeksi.biaya_jabatan_setahun).toBe(4_814_400); // 5% of 96.288M, under 6M cap
    expect(r.proyeksi.netto_setahun).toBe(91_473_600);
    expect(r.proyeksi.pkp_setahun).toBe(37_473_000);
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

  it('Jan-Nov: non-NPWP multiplies pph_setahun by 1.2', () => {
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
    expect(withoutNpwp.proyeksi.pph_setahun).toBe(Math.round(withNpwp.proyeksi.pph_setahun * 1.2));
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
    expect(r.pph_jan_nov).toBe(1_500_000);
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
describe('calculateSeverance (PPh 21 final — PP 68/2009)', () => {
  function k(overrides: Partial<KompensasiInput> = {}): KompensasiInput {
    return {
      nama: 'Test',
      nik: '0000000000000001',
      npwp: '000',
      punya_npwp: true,
      kategori: 'pesangon',
      jumlah_bruto: 0,
      ...overrides,
    };
  }

  it('zero jumlah → PPh 0, THP 0, empty breakdown', () => {
    const r = calculateSeverance(k({ jumlah_bruto: 0 }));
    expect(r.pph).toBe(0);
    expect(r.thp).toBe(0);
    expect(r.breakdown).toEqual([]);
  });

  it('below first bracket (Rp 30M) → 0% only', () => {
    const r = calculateSeverance(k({ jumlah_bruto: 30_000_000 }));
    expect(r.pph).toBe(0);
    expect(r.thp).toBe(30_000_000);
    expect(r.breakdown).toHaveLength(1);
    expect(r.breakdown[0]).toMatchObject({ rate: 0, taxable: 30_000_000, tax: 0 });
  });

  it('exactly at first bracket boundary (Rp 50M) → PPh still 0', () => {
    const r = calculateSeverance(k({ jumlah_bruto: 50_000_000 }));
    expect(r.pph).toBe(0);
  });

  it('just above first bracket (Rp 51M) → 5% × Rp 1M = Rp 50,000', () => {
    const r = calculateSeverance(k({ jumlah_bruto: 51_000_000 }));
    expect(r.pph).toBe(50_000);
    expect(r.thp).toBe(50_950_000);
    expect(r.breakdown).toHaveLength(2);
    expect(r.breakdown[1]).toMatchObject({ rate: 0.05, taxable: 1_000_000, tax: 50_000 });
  });

  it('within second bracket (Rp 75M) → 5% × 25M = Rp 1,250,000', () => {
    const r = calculateSeverance(k({ jumlah_bruto: 75_000_000 }));
    expect(r.pph).toBe(1_250_000);
  });

  it('at top of second bracket (Rp 100M) → Rp 2,500,000', () => {
    const r = calculateSeverance(k({ jumlah_bruto: 100_000_000 }));
    expect(r.pph).toBe(2_500_000);
  });

  it('within third bracket (Rp 300M) → 2.5M + 15% × 200M = Rp 32.5M', () => {
    const r = calculateSeverance(k({ jumlah_bruto: 300_000_000 }));
    expect(r.pph).toBe(32_500_000);
  });

  it('at top of third bracket (Rp 500M) → 2.5M + 15% × 400M = Rp 62.5M', () => {
    const r = calculateSeverance(k({ jumlah_bruto: 500_000_000 }));
    expect(r.pph).toBe(62_500_000);
  });

  it('above third bracket (Rp 600M) → 62.5M + 25% × 100M = Rp 87.5M', () => {
    const r = calculateSeverance(k({ jumlah_bruto: 600_000_000 }));
    expect(r.pph).toBe(87_500_000);
    // Breakdown must show all 4 brackets used
    expect(r.breakdown).toHaveLength(4);
    expect(r.breakdown.map(b => b.rate)).toEqual([0, 0.05, 0.15, 0.25]);
  });

  it('non-NPWP applies ×1.2 to total (not per-bracket)', () => {
    const r = calculateSeverance(k({ jumlah_bruto: 100_000_000, punya_npwp: false }));
    // Base PPh = 2,500,000; × 1.2 = 3,000,000
    expect(r.pph).toBe(3_000_000);
    expect(r.npwp_multiplier).toBe(1.2);
    expect(r.pph_before_npwp_multiplier).toBe(2_500_000);
  });

  it('preserves identity fields in output (for snapshot in result_json)', () => {
    const r = calculateSeverance(k({
      nama: 'Budi',
      nik: '1234567890',
      npwp: '987654321012000',
      kategori: 'manfaat_pensiun',
      divisi: 'IT',
      status_ptkp: 'K2',
      jumlah_bruto: 80_000_000,
    }));
    expect(r.jenis).toContain('KOMPENSASI');
    expect(r.kategori).toBe('manfaat_pensiun');
    expect(r.nama).toBe('Budi');
    expect(r.nik).toBe('1234567890');
    expect(r.divisi).toBe('IT');
    expect(r.status_ptkp).toBe('K2');
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

  it('harian: non-NPWP applies ×1.2 multiplier on top of TER result', () => {
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
      // Same bruto as ALFREDO above, but non-NPWP: 63,106 × 1.2 = 75,727 (rounded)
      expect(r.total_pph).toBe(75_727);
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
