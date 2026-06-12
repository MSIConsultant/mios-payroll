import { PTKP, PTKP_TER_GRUP, PASAL17, TER, BPJS, JP_MAX_BASIS, KES_MAX_BASIS, BIAYA_JAB_RATE, BIAYA_JAB_MAX } from "./constants";

// ─── Non-NPWP surcharge (formerly ×1.2) ──────────────────────────────────
// Removed 2026-05-29 per PENG-6/PJ.09/2024 in combination with the NIK=NPWP
// integration mandated by PMK 112/2022 (fully effective 2024). The 20%
// surcharge in UU PPh Pasal 21(5a) / PMK 168/2023 Pasal 11(4) legally still
// exists, but PENG-6/PJ.09/2024 exempts any income recipient who presents a
// valid NIK — which is now every Indonesian resident. In practice the
// surcharge applies only to TKA without Indonesian NPWP, and those workers
// are routed through PPh 26 (a different calculation; see the pph_26 flag
// migration `2026-05-29-tka-pph26-fields.sql`). The `punya_npwp` field is
// preserved on the engine input for reporting (slip gaji, SPT Masa CSV)
// but no longer multiplies any computed PPh figure.

export interface KaryawanTetap {
    nama: string;
    nik: string;
    npwp: string;
    divisi: string;
    jenis_kelamin: string;
    bulan: number;
    tahun: number;
    status_ptkp: string;
    punya_npwp: boolean;
    gaji_pokok: number;
    /**
     * Optional BPJS-declared salary basis. When null/undefined, falls back to
     * `gaji_pokok`. Set this when the company has registered a separate (usually
     * lower) salary with BPJS than the actual gaji_pokok — very common in
     * Indonesian payroll practice. Affects JKK, JKM, JHT, JP, and Kes basis.
     */
    bpjs_basis?: number | null;
    benefit: number;
    kendaraan: number;
    pulsa: number;
    operasional: number;
    tunj_lain: number;
    thr: number;
    bonus: number;
    ikut_jht: boolean;
    ikut_jp: boolean;
    ikut_jkp: boolean;
    jkk_rate: number;
    tanggung_jht_k: boolean;
    tanggung_jp_k: boolean;
    ikut_kes: boolean;
    tanggung_kes_k: boolean;
    /**
     * Whether the employer KES contribution (4%) is included in taxable bruto.
     * Defaults to true. Set to false for schemes where the employee pays their
     * own KES (tanggung_kes_k=false) and the employer's share is treated as an
     * off-slip cost — matching the accountant's Excel for BPJS-dipotong schemes.
     */
    kes_employer_in_bruto?: boolean;
    pph_ditanggung: boolean;
    kasbon: number;
    alpha_telat: number;
    pot_lain: number;
    pph_jan_nov: number;
    akum_bruto: number;
    /**
     * Mark this month as the employee's LAST month of employment in the tax
     * year. Triggers a Pasal 17 reconciliation calculation (same shape as
     * December) regardless of which calendar month it is. Use when an employee
     * exits mid-year — the accountant rule is that the final paycheck must
     * reconcile annual PPh, not continue with TER. Combine with `months_in_year`
     * to scale biaya jabatan and iuran caps.
     */
    isLastMonth?: boolean;
    /**
     * Number of months the employee actually worked in this tax year. Used to
     * scale the biaya jabatan annual cap (Rp 500,000 × months_in_year) and the
     * iuran JHT/JP karyawan deduction in the Pasal 17 netto calculation.
     * Defaults to 12 when omitted (e.g. full-year employee in December).
     */
    months_in_year?: number;
}

export interface KaryawanTidakTetap {
    nama: string;
    nik: string;
    npwp: string;
    divisi: string;
    bulan: number;
    tahun: number;
    status_ptkp: string;
    punya_npwp: boolean;
    mode: "harian" | "bulanan";
    upah_harian: number;
    hari_kerja: number;
    upah_bulanan: number;
    tunjangan: number;
    ikut_bpjs_tk: boolean;
    ikut_kes: boolean;
    kasbon: number;
    pot_lain: number;
    thr?: number;
    bonus?: number;
}

export function getTerRate(bruto_bulanan: number, grup: "A" | "B" | "C"): number {
    for (const [lo, hi, r] of TER[grup]) {
        if (lo <= bruto_bulanan && bruto_bulanan <= hi) {
            return r;
        }
    }
    const last = TER[grup][TER[grup].length - 1];
    return last[2];
}

export function getPasal17Tax(pkp_tahunan: number): number {
    const pkp = Math.max(0.0, Math.floor(pkp_tahunan / 1000) * 1000);
    let tax = 0.0;
    let sisa = pkp;
    for (const [bracket, rate] of PASAL17) {
        if (sisa <= 0) break;
        const potongan = Math.min(sisa, bracket);
        tax += potongan * rate;
        sisa -= potongan;
    }
    return Math.round(tax);
}

export function calculateBPJS(basis: number, k: KaryawanTetap) {
    const jp_basis = Math.min(basis, JP_MAX_BASIS);
    const kes_basis = Math.min(basis, KES_MAX_BASIS);

    // Keep components as raw floats — the accountant's Excel keeps decimal BPJS
    // values (e.g. 13,751.70) throughout. Rounding per-component introduces
    // accumulated error in bruto and can shift TER brackets. Round only at the
    // point of actual cash deduction (karyawan_potong in the THP formula).
    const jkk = basis * k.jkk_rate;
    const jkm = basis * BPJS.jkm;
    const jht_e = k.ikut_jht ? basis * BPJS.jht_e : 0;
    const jp_e = k.ikut_jp ? jp_basis * BPJS.jp_e : 0;
    const jkp = 0;
    const kes_e = k.ikut_kes ? kes_basis * BPJS.kes_e : 0;

    const jht_k = k.ikut_jht ? basis * BPJS.jht_k : 0;
    const jp_k = k.ikut_jp ? jp_basis * BPJS.jp_k : 0;
    const kes_k = k.ikut_kes ? kes_basis * BPJS.kes_k : 0;

    const tunj_jht = k.tanggung_jht_k ? jht_k : 0;
    const tunj_jp = k.tanggung_jp_k ? jp_k : 0;
    const tunj_kes = k.tanggung_kes_k ? kes_k : 0;

    const pot_jht = k.tanggung_jht_k ? 0 : jht_k;
    const pot_jp = k.tanggung_jp_k ? 0 : jp_k;
    const pot_kes = k.tanggung_kes_k ? 0 : kes_k;

    return {
        jkk, jkm, jht_e, jp_e, jkp, kes_e,
        employer_in_bruto: jkk + jkm + (k.kes_employer_in_bruto !== false ? kes_e : 0),
        employer_offslip: jht_e + jp_e + jkp,
        employer_total: jkk + jkm + jht_e + jp_e + jkp + kes_e,
        jht_k, jp_k, kes_k,
        tunj_jht, tunj_jp, tunj_kes,
        pot_jht, pot_jp, pot_kes,
        karyawan_tunj: tunj_jht + tunj_jp + tunj_kes,
        karyawan_potong: pot_jht + pot_jp + pot_kes,
        _basis: basis, _jp_basis: jp_basis, _kes_basis: kes_basis,
    };
}

export function calculateMonthlySalary(k: KaryawanTetap) {
    const grup = PTKP_TER_GRUP[k.status_ptkp] as "A" | "B" | "C";
    // BPJS basis is the declared salary registered with BPJS, which is often
    // separate from (lower than) gaji_pokok. Falls back to gaji_pokok when not
    // set OR when explicitly zero (a zero bpjs_basis with active BPJS flags is
    // a UI artefact — the import parser converts 0 to undefined; the form
    // saves whatever the user types). Treating 0 as "use gaji_pokok" matches
    // the import semantics and avoids accidental zeroed BPJS deductions.
    const basis = k.bpjs_basis && k.bpjs_basis > 0 ? k.bpjs_basis : k.gaji_pokok;

    const allowance_total = k.benefit + k.kendaraan + k.pulsa + k.operasional + k.tunj_lain;
    const irregular_total = k.thr + k.bonus;
    const bpjs = calculateBPJS(basis, k);

    // Initial base without PPh Grossup
    // Bruto = Regular + Irregular + BPJS Employer (Taxable) + Tunjangan BPJS Employee
    const base = k.gaji_pokok + allowance_total + irregular_total + bpjs.employer_in_bruto + bpjs.karyawan_tunj;

    if (k.bulan === 12 || k.isLastMonth === true) {
        const monthsInYear = k.months_in_year ?? 12;
        return calculateLastMonth(k, bpjs, allowance_total, base, grup, k.akum_bruto, monthsInYear);
    }

    let pph = 0;
    let tunj_pph = 0;
    let pot_pph = 0;
    // Grossup convergence diagnostics. _converged === false on:
    //   1. `t >= 1.0` early break — the TER rate saturates (impossible at
    //      current bracket maximum 0.34, but kept as a guard).
    //   2. The 200-iteration fall-through path with no convergence detected.
    // Calling code (UI) should surface a warning in these cases.
    let _converged = !k.pph_ditanggung; // non-grossup branch is trivially converged
    let _iterations = 0;

    if (k.pph_ditanggung) {
        let prev = -1.0;
        for (let i = 0; i < 200; i++) {
            _iterations = i + 1;
            const t = getTerRate(base + pph, grup);
            if (t === 0) {
                pph = 0.0;
                _converged = true;
                break;
            }
            if (t >= 1.0) {
                // TER saturation — leave _converged false and exit
                break;
            }
            const n = (t * base) / (1 - t);
            if (Math.abs(n - prev) < 0.01) {
                pph = Math.round((n + prev) / 2);
                _converged = true;
                break;
            }
            if (Math.abs(n - pph) < 0.01) {
                pph = Math.round(n);
                _converged = true;
                break;
            }
            prev = pph;
            pph = n;
        }
        if (!_converged) {
            pph = Math.round(pph);
        }
        tunj_pph = Math.round(pph);
        pot_pph = 0;
    } else {
        const t = getTerRate(base, grup);
        pph = Math.round(t * base);
        tunj_pph = 0;
        pot_pph = pph;
    }

    const bruto = base + tunj_pph;
    const ter = getTerRate(bruto, grup);

    const thp = k.gaji_pokok + allowance_total + irregular_total - Math.round(bpjs.karyawan_potong) - pot_pph - k.kasbon - k.alpha_telat - k.pot_lain;

    // Annual projection: matches the accountant's standard Excel layout where
    // every monthly worksheet shows "PPH 21 SETAHUN / PPH JAN-NOV / PPH DES" as
    // a forecast assuming the current month's bruto continues for the rest of
    // the year. Useful as a reconciliation aid and December surprise prevention.
    const proyeksi = computeAnnualProjection(k, bruto, pph, bpjs);

    return {
        jenis: "GAJI BULANAN INTEGRATED",
        bulan: k.bulan,
        tahun: k.tahun,
        grup, ter,
        status_ptkp: k.status_ptkp,
        basis, bpjs,
        gaji_pokok: k.gaji_pokok,
        allowance_total, benefit: k.benefit,
        kendaraan: k.kendaraan, pulsa: k.pulsa,
        operasional: k.operasional, tunj_lain: k.tunj_lain,
        thr_nominal: k.thr, bonus_nominal: k.bonus,
        tunj_pph, base, bruto, pph, pot_pph,
        pph_ditanggung: k.pph_ditanggung,
        kasbon: k.kasbon, alpha_telat: k.alpha_telat, pot_lain: k.pot_lain,
        thp,
        proyeksi,
        _converged,
        _iterations,
    };
}

/**
 * Annual projection if the current month's bruto continued for all 12 months.
 * Mirrors the accountant's spreadsheet "PPH 21 SETAHUN / PPH JAN-NOV / PPH DES"
 * forecast columns. Used as a reconciliation aid on Jan-Nov payroll pages.
 *
 * For an isolated month where no prior data exists this is a hypothetical:
 * "if you stay at this rate, December's equalization will look like this".
 */
function computeAnnualProjection(
    k: KaryawanTetap,
    monthlyBruto: number,
    monthlyPph: number,
    bpjs: ReturnType<typeof calculateBPJS>,
) {
    const ptkp = PTKP[k.status_ptkp];
    const bruto_setahun = monthlyBruto * 12;
    const biaya_jabatan_setahun = Math.min(bruto_setahun * BIAYA_JAB_RATE, BIAYA_JAB_MAX * 12);
    // PMK 168/2023 Pasal 10: JHT and JP karyawan are deductible; Kes is not.
    // Previously only JP was deducted here — now consistent with calculateLastMonth.
    const jht_k_tahunan = (k.ikut_jht && !k.tanggung_jht_k) ? bpjs.jht_k * 12 : 0;
    const jp_k_tahunan  = (k.ikut_jp  && !k.tanggung_jp_k)  ? bpjs.jp_k  * 12 : 0;
    const netto_setahun = bruto_setahun - biaya_jabatan_setahun - jht_k_tahunan - jp_k_tahunan;
    const pkp_setahun = Math.max(0, Math.floor((netto_setahun - ptkp) / 1000) * 1000);
    const pph_setahun = getPasal17Tax(pkp_setahun);
    // Non-NPWP surcharge removed 2026-05-29 — see top-of-file note.
    const pph_jan_nov_proyeksi = Math.round(monthlyPph * 11);
    const pph_desember_proyeksi = Math.max(0, pph_setahun - pph_jan_nov_proyeksi);
    return {
        bruto_setahun,
        biaya_jabatan_setahun,
        jht_k_tahunan,
        jp_k_tahunan,
        netto_setahun,
        pkp_setahun,
        pph_setahun,
        pph_jan_nov_proyeksi,
        pph_desember_proyeksi,
    };
}

/**
 * Pasal 17 reconciliation for an employee's LAST month of work in the tax year.
 *
 * - December (full-year employee): pass `monthsInYear = 12` (default).
 * - Mid-year exit (e.g. starts Jun, ends Aug): pass `monthsInYear = 3`. Biaya
 *   jabatan cap and iuran karyawan annual figures scale accordingly.
 *
 * Per accountant spec & UU HPP Pasal 17:
 *   Netto = Bruto setahun − Biaya Jabatan − Iuran JHT karyawan − Iuran JP karyawan
 *   PKP   = max(0, floor((Netto − PTKP) / 1000) × 1000)
 *   PPh   = Pasal 17 brackets (5/15/25/30/35) × PKP
 *   This month's PPh = PPh setahun − PPh Jan–Nov (or whatever was already paid)
 *
 * When already-withheld PPh exceeds the annual liability, `raw_pph` is negative
 * and `is_refund` is true with `refund_amount` set. The on-slip `pph` is still
 * clamped to 0 (you can't deduct negative tax from gaji); the refund must be
 * handled separately by the employer.
 *
 * When `pph_ditanggung` (employer pays PPh as tunjangan), this month's tunjangan
 * is found via iteration: find `tp` such that
 *   PPh_setahun = Pasal17(PKP(bs_base + tp))  AND  tp = max(0, PPh_setahun − pph_jan_nov)
 * Converges in < 10 steps because the increment's marginal rate < 100%.
 * The iteration result is equivalent to the closed-form TP = PPh_no_grossup / (1 − tarif_marginal)
 * when biaya jabatan is already at its cap; they diverge by at most a few rupiah otherwise.
 */
export function calculateLastMonth(
    k: KaryawanTetap,
    bpjs: ReturnType<typeof calculateBPJS>,
    allowance_total: number,
    base: number,
    grup: "A" | "B" | "C",
    akum_bruto: number = 0,
    monthsInYear: number = 12,
) {
    const ptkp = PTKP[k.status_ptkp];
    const M = Math.max(1, Math.min(12, Math.round(monthsInYear)));

    // When akum_bruto is 0 (no prior runs persisted for this employee/year),
    // we annualize from the current month alone — plausible-looking but likely
    // wrong if the employee actually worked prior months. Surface as
    // `proyeksi.is_estimate: true` so the UI can render a stronger warning
    // than the standard "Equalisasi Desember" info card.
    const is_estimate = !(akum_bruto > 0);
    const bs_base = is_estimate ? (base * M) : (akum_bruto + base);

    // Compute Pasal 17 annual tax for a given bruto setahun.
    // Biaya jabatan cap scales with M. Per UU HPP, JHT and JP karyawan iuran
    // are deductible; BPJS Kes karyawan is NOT deductible.
    const computeAnnual = (bs: number) => {
        const bj = Math.min(bs * BIAYA_JAB_RATE, BIAYA_JAB_MAX * M);
        const jht_k_ann = (k.ikut_jht && !k.tanggung_jht_k) ? bpjs.jht_k * M : 0;
        const jp_k_ann  = (k.ikut_jp  && !k.tanggung_jp_k)  ? bpjs.jp_k  * M : 0;
        const netto = bs - bj - jht_k_ann - jp_k_ann;
        const pkp = Math.max(0, Math.floor((netto - ptkp) / 1000) * 1000);
        const pth = getPasal17Tax(pkp);
        // Non-NPWP surcharge removed 2026-05-29 — see top-of-file note.
        return { bj, jht_k_tahunan: jht_k_ann, jp_k_tahunan: jp_k_ann, netto, pkp, pth };
    };

    // Phase 1: no-grossup reference values (used in display and as iteration seed)
    const base_annual = computeAnnual(bs_base);
    const pph_no_grossup = base_annual.pth;
    const pkp_no_grossup = base_annual.pkp;

    let tunj_pph = 0; // this month's tunjangan PPh (0 for non-grossup)
    let bs = bs_base;
    let annual = base_annual;

    if (k.pph_ditanggung) {
        // Iterative grossup: find tp (December's tunj_pph) such that
        //   PPh_setahun(bs_base + tp) − pph_jan_nov = tp
        // Starting from tp=0 always converges because each step's increment
        // is multiplied by the marginal rate (< 1), making it a contraction map.
        let tp = 0;
        for (let i = 0; i < 50; i++) {
            const iter = computeAnnual(bs_base + tp);
            const new_tp = Math.max(0, Math.round(iter.pth - k.pph_jan_nov));
            if (Math.abs(new_tp - tp) < 1) {
                tp = new_tp;
                bs = bs_base + tp;
                annual = computeAnnual(bs);
                break;
            }
            tp = new_tp;
        }
        tunj_pph = tp;
    }

    const { bj, jht_k_tahunan, jp_k_tahunan, netto, pkp, pth } = annual;

    const rawPph = Math.round(pth - k.pph_jan_nov);
    // Over-withholding. For non-grossup the employee is owed a cash refund
    // (is_refund/refund_amount). For grossup the employer over-paid tunjangan
    // during the year. Either way the accountant's REKAP sheet reports the
    // negative "PPH DES" — `lebih_potong` carries that amount (≥ 0) for both
    // schemes so the UI can show it; on-slip pph/pot_pph stay clamped to 0.
    const isRefund = !k.pph_ditanggung && rawPph < 0;
    const refundAmount = isRefund ? -rawPph : 0;
    const lebihPotong = Math.max(0, -rawPph);
    const pot_pph = k.pph_ditanggung ? 0 : Math.max(0, rawPph);
    const pph_this = k.pph_ditanggung ? tunj_pph : Math.max(0, rawPph);

    // THR/bonus paid in the last month are part of that month's take-home,
    // same as calculateMonthlySalary's irregular_total.
    const thp = k.gaji_pokok + allowance_total + k.thr + k.bonus - Math.round(bpjs.karyawan_potong) - pot_pph - k.kasbon - k.alpha_telat - k.pot_lain;

    const proyeksi = {
        bruto_setahun: bs,
        biaya_jabatan_setahun: bj,
        netto_setahun: netto,
        pkp_setahun: pkp,
        pph_setahun: pth,
        pph_jan_nov_proyeksi: k.pph_jan_nov,
        pph_desember_proyeksi: pph_this,
        is_estimate,
    };

    const jenis = M === 12 && k.bulan === 12
        ? "GAJI — DESEMBER (Equalisasi Pasal 17)"
        : "GAJI — BULAN TERAKHIR (Equalisasi Pasal 17)";

    return {
        jenis,
        bulan: k.bulan, tahun: k.tahun,
        grup, ter: null, status_ptkp: k.status_ptkp,
        basis: k.gaji_pokok, bpjs,
        gaji_pokok: k.gaji_pokok, allowance_total,
        benefit: k.benefit, kendaraan: k.kendaraan,
        pulsa: k.pulsa, operasional: k.operasional, tunj_lain: k.tunj_lain,
        tunj_pph, base, bruto: base + tunj_pph,
        // Annual calculation fields (for display in Pasal17BreakdownPanel)
        bs, bs_base, bj, jht_k_tahunan, jp_k_tahunan, netto, pkp, ptkp,
        pph_tahunan: pth,
        pph_no_grossup,    // PPh without grossup (reference for TP formula display)
        pkp_no_grossup,    // PKP without grossup
        tunj_pph_setahun: k.pph_ditanggung ? pth : 0, // total annual employer PPh obligation
        thr_nominal: k.thr, bonus_nominal: k.bonus,
        pph_jan_nov: k.pph_jan_nov,
        pph: pph_this, pot_pph, pph_ditanggung: k.pph_ditanggung,
        kasbon: k.kasbon, alpha_telat: k.alpha_telat, pot_lain: k.pot_lain,
        thp,
        proyeksi,
        is_last_month: true,
        months_in_year: M,
        raw_pph: rawPph,
        is_refund: isRefund,
        refund_amount: refundAmount,
        lebih_potong: lebihPotong,
    };
}

/**
 * Backward-compat alias: full-year December reconciliation (monthsInYear=12).
 * Existing callers don't need to change.
 */
export function calculateDecember(k: KaryawanTetap, bpjs: ReturnType<typeof calculateBPJS>, allowance_total: number, base: number, grup: "A" | "B" | "C", akum_bruto: number = 0) {
    return calculateLastMonth(k, bpjs, allowance_total, base, grup, akum_bruto, 12);
}

export function calculateTHRBonus(k: KaryawanTetap, thr: number = 0, bonus: number = 0) {
    const ptkp = PTKP[k.status_ptkp];
    // Same defensive fallback as calculateMonthlySalary: explicit 0 → gaji_pokok.
    const basis = k.bpjs_basis && k.bpjs_basis > 0 ? k.bpjs_basis : k.gaji_pokok;

    const allowance_total = k.benefit + k.kendaraan + k.pulsa + k.operasional + k.tunj_lain;
    const bpjs = calculateBPJS(basis, k);
    const base_bln = k.gaji_pokok + allowance_total + bpjs.employer_in_bruto + bpjs.karyawan_tunj;

    const br_reg = base_bln * 12;
    const bj = Math.min(br_reg * BIAYA_JAB_RATE, BIAYA_JAB_MAX * 12);
    const jp_k_y = !k.tanggung_jp_k ? bpjs.jp_k * 12 : 0;
    const n_reg = br_reg - bj - jp_k_y;
    const pkp_reg = Math.max(0, Math.floor((n_reg - ptkp) / 1000) * 1000);
    const pph_reg = getPasal17Tax(pkp_reg);

    const hasil: Record<string, any> = {};

    for (const [label, jumlah] of [["THR", thr], ["Bonus", bonus]] as const) {
        if (jumlah <= 0) continue;
        const br_dgn = br_reg + (jumlah as number);
        const n_dgn = br_dgn - bj - jp_k_y;
        const pkp_dgn = Math.max(0, Math.floor((n_dgn - ptkp) / 1000) * 1000);
        const pph_dgn = getPasal17Tax(pkp_dgn);
        const pph_item = Math.max(0, Math.round(pph_dgn - pph_reg));
        // Non-NPWP surcharge removed 2026-05-29 — see top-of-file note.

        const tunj_pph = k.pph_ditanggung ? pph_item : 0;
        const pot_pph = k.pph_ditanggung ? 0 : pph_item;
        const pot_bpjs = bpjs.karyawan_potong;

        const thp = k.gaji_pokok + allowance_total + (jumlah as number) - pot_bpjs - pot_pph - k.kasbon - k.alpha_telat - k.pot_lain;

        hasil[label.toString()] = {
            jenis: `SLIP ${label}`, status_ptkp: k.status_ptkp,
            jumlah, basis, bpjs,
            gaji_pokok: k.gaji_pokok, allowance_total,
            benefit: k.benefit, kendaraan: k.kendaraan,
            pulsa: k.pulsa, operasional: k.operasional, tunj_lain: k.tunj_lain,
            tunj_pph, br_reg, br_dgn, bj, n_reg, n_dgn,
            pkp_reg, pkp_dgn, pph_reg, pph_dgn, pph: pph_item,
            pot_pph, pot_bpjs, pph_ditanggung: k.pph_ditanggung,
            kasbon: k.kasbon, alpha_telat: k.alpha_telat, pot_lain: k.pot_lain,
            thp,
        };
    }

    return hasil;
}

export function calculateFreelance(k: KaryawanTidakTetap) {
    const ptkp = PTKP[k.status_ptkp];

    if (k.mode === "harian") {
        // Per PMK 168/2023, pegawai tidak tetap harian use the TER method
        // on the cumulative monthly bruto, looked up by PTKP grup. The
        // accountant's HARIAN sheet confirms this — e.g., bruto Rp 6,310,559
        // with TK0 (TER A) at the 0.01 bracket → PPh Rp 63,106.
        const grup = PTKP_TER_GRUP[k.status_ptkp] as "A" | "B" | "C";
        const upah_reg = k.upah_harian * k.hari_kerja;
        const total_upah = upah_reg + (k.thr || 0) + (k.bonus || 0);
        const ter = getTerRate(total_upah, grup);

        const total_pph = Math.round(total_upah * ter);
        // Non-NPWP surcharge removed 2026-05-29 — see top-of-file note.

        const pph_per_hari = k.hari_kerja > 0
            ? Math.round(total_pph / k.hari_kerja)
            : 0;

        const keterangan = total_upah === 0
            ? "Tidak ada upah"
            : ter === 0
                ? `TER ${grup} bracket 0 → PPh nihil`
                : `TER ${grup} ${(ter * 100).toFixed(2)}% × bruto`;

        const thp = total_upah - total_pph - k.kasbon - k.pot_lain;

        return {
            mode: "harian", status_ptkp: k.status_ptkp,
            grup, ter,
            upah_harian: k.upah_harian, hari_kerja: k.hari_kerja,
            total_upah,
            // legacy field kept for backward compat — no longer meaningful under TER
            ptkp_harian: 0,
            pph_per_hari, total_pph,
            kasbon: k.kasbon, pot_lain: k.pot_lain, thp, keterangan,
        };
    } else {
        const upah = k.upah_bulanan + k.tunjangan + (k.thr || 0) + (k.bonus || 0);
        let pph = 0;
        let pkp = 0;
        let keterangan = "";
        
        if (upah <= 4_500_000) {
            keterangan = "Penghasilan <= Rp 4.500.000/bulan -> PPh Nihil";
        } else {
            const bt = upah * 12;
            const bj = Math.min(bt * BIAYA_JAB_RATE, BIAYA_JAB_MAX * 12);
            pkp = Math.max(0, Math.floor((bt - bj - ptkp) / 1000) * 1000);
            pph = Math.round(getPasal17Tax(pkp) / 12);
            keterangan = "Pasal 17 (annualized) / 12";
            // Non-NPWP surcharge removed 2026-05-29 — see top-of-file note.
        }
        
        const bk: Record<string, number> = {};
        if (k.ikut_bpjs_tk) {
            const jp_b = Math.min(k.upah_bulanan, JP_MAX_BASIS);
            bk.jht = Math.round(k.upah_bulanan * BPJS.jht_k);
            bk.jp = Math.round(jp_b * BPJS.jp_k);
            bk.kes = k.ikut_kes ? Math.round(Math.min(k.upah_bulanan, KES_MAX_BASIS) * BPJS.kes_k) : 0;
        }
        
        const tot_bpjs = Object.values(bk).reduce((a, b) => a + b, 0);
        const thp = upah - pph - tot_bpjs - k.kasbon - k.pot_lain;
        
        return {
            mode: "bulanan", status_ptkp: k.status_ptkp,
            upah_bulanan: k.upah_bulanan, tunjangan: k.tunjangan,
            total_upah: upah, bk, tot_bpjs,
            pkp, pph, kasbon: k.kasbon, pot_lain: k.pot_lain, thp, keterangan,
        };
    }
}
