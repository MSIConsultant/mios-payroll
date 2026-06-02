/**
 * Projection plumbing tests. These do NOT re-test the engine math (that lives
 * in payroll.test.ts) — they lock the invariant the /simulasi December
 * breakdown UI relies on: bruto_setahun is exactly the accumulated prior
 * months plus the reconciliation month's own bruto.
 */
import { describe, it, expect } from 'vitest';
import { runMonthlyProjection, DEFAULT_PROJ_PARAMS, type ProjParams, type MonthOverride } from './projection';

const base: ProjParams = {
  ...DEFAULT_PROJ_PARAMS,
  gajiPokok: 15_000_000,
  pphDitanggung: false, // exercise the non-grossup path
};

describe('projection bruto_setahun decomposition', () => {
  it('akum_bruto + reconciliation-month bruto === bruto_setahun (full year, with THR & bonus)', () => {
    const overrides: Record<number, MonthOverride> = { 4: { thr: 15_000_000 }, 9: { bonus: 7_500_000 } };
    const proj = runMonthlyProjection(base, overrides);
    expect(proj).not.toBeNull();
    const dec = proj!.rows.find(r => r.isReconciliation)!;
    expect(dec.bulan).toBe(12);
    expect(dec.p17_is_estimate).toBeFalsy();
    expect(dec.p17_months_counted).toBe(11);
    expect((dec.p17_akum_bruto ?? 0) + dec.bruto).toBe(dec.p17_bruto_setahun);
  });

  it('holds for the grossup path as well (grossup tunj sits inside Dec bruto)', () => {
    const proj = runMonthlyProjection({ ...base, pphDitanggung: true }, {});
    const dec = proj!.rows.find(r => r.isReconciliation)!;
    expect((dec.p17_akum_bruto ?? 0) + dec.bruto).toBe(dec.p17_bruto_setahun);
  });

  it('mid-year exit reconciles on the last active month', () => {
    // Active Jan–Aug only (employee leaves) → last active month is the P17 month.
    const overrides = Object.fromEntries(
      [9, 10, 11, 12].map(b => [b, { aktif: false as const }]),
    ) as Record<number, MonthOverride>;
    const proj = runMonthlyProjection(base, overrides);
    const rec = proj!.rows.find(r => r.isReconciliation)!;
    expect(rec.bulan).toBe(8);
    expect(rec.p17_months_counted).toBe(7); // Jan–Jul accumulated
    expect((rec.p17_akum_bruto ?? 0) + rec.bruto).toBe(rec.p17_bruto_setahun);
  });
});
