import { PTKP, PTKP_TER_GRUP, PASAL17, PESANGON_BRACKETS, TER, BPJS, JP_MAX_BASIS, KES_MAX_BASIS, BIAYA_JAB_RATE, BIAYA_JAB_MAX } from "./constants";

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

    const jkk = Math.round(basis * k.jkk_rate);
    const jkm = Math.round(basis * BPJS.jkm);
    const jht_e = k.ikut_jht ? Math.round(basis * BPJS.jht_e) : 0;
    const jp_e = k.ikut_jp ? Math.round(jp_basis * BPJS.jp_e) : 0;
    const jkp = 0;
    const kes_e = k.ikut_kes ? Math.round(kes_basis * BPJS.kes_e) : 0;

    const jht_k = k.ikut_jht ? Math.round(basis * BPJS.jht_k) : 0;
    const jp_k = k.ikut_jp ? Math.round(jp_basis * BPJS.jp_k) : 0;
    const kes_k = k.ikut_kes ? Math.round(kes_basis * BPJS.kes_k) : 0;

    const tunj_jht = k.tanggung_jht_k ? jht_k : 0;
    const tunj_jp = k.tanggung_jp_k ? jp_k : 0;
    const tunj_kes = k.tanggung_kes_k ? kes_k : 0;

    const pot_jht = k.tanggung_jht_k ? 0 : jht_k;
    const pot_jp = k.tanggung_jp_k ? 0 : jp_k;
    const pot_kes = k.tanggung_kes_k ? 0 : kes_k;

    return {
        jkk, jkm, jht_e, jp_e, jkp, kes_e,
        employer_in_bruto: jkk + jkm + kes_e,
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
    // separate from (lower than) gaji_pokok. Falls back to gaji_pokok when not set.
    const basis = k.bpjs_basis ?? k.gaji_pokok;

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

    const npwp_mult = !k.punya_npwp ? 1.2 : 1.0;
    let pph = 0;
    let tunj_pph = 0;
    let pot_pph = 0;
    // Grossup convergence diagnostics. _converged === false on:
    //   1. `mt >= 1.0` early break — the TER × non-NPWP multiplier saturates
    //      (impossible/extreme PKP); the loop bails with stale `pph`.
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
            const mt = npwp_mult * t;
            if (mt >= 1.0) {
                // mt saturation — leave _converged false and exit
                break;
            }
            const n = (mt * base) / (1 - mt);
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
        pph = Math.round(npwp_mult * t * base);
        tunj_pph = 0;
        pot_pph = pph;
    }

    const bruto = base + tunj_pph;
    const ter = getTerRate(bruto, grup);

    const thp = k.gaji_pokok + allowance_total + irregular_total - bpjs.karyawan_potong - pot_pph - k.kasbon - k.alpha_telat - k.pot_lain;

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
    const jp_k_tahunan = !k.tanggung_jp_k ? bpjs.jp_k * 12 : 0;
    const netto_setahun = bruto_setahun - biaya_jabatan_setahun - jp_k_tahunan;
    const pkp_setahun = Math.max(0, Math.floor((netto_setahun - ptkp) / 1000) * 1000);
    let pph_setahun = getPasal17Tax(pkp_setahun);
    if (!k.punya_npwp) {
        pph_setahun = Math.round(pph_setahun * 1.2);
    }
    const pph_jan_nov_proyeksi = Math.round(monthlyPph * 11);
    const pph_desember_proyeksi = Math.max(0, pph_setahun - pph_jan_nov_proyeksi);
    return {
        bruto_setahun,
        biaya_jabatan_setahun,
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
    const bs = is_estimate ? (base * M) : (akum_bruto + base);
    const bj = Math.min(bs * BIAYA_JAB_RATE, BIAYA_JAB_MAX * M);

    // Iuran karyawan = what the employee actually pays out of pocket (dipotong
    // dari gaji). Only deduct when the company isn't covering it as tunjangan,
    // AND when the employee participates in that program. Per UU HPP, both JHT
    // and JP karyawan iuran are deductible — earlier code deducted only JP.
    const jht_k_tahunan = (k.ikut_jht && !k.tanggung_jht_k) ? bpjs.jht_k * M : 0;
    const jp_k_tahunan  = (k.ikut_jp  && !k.tanggung_jp_k)  ? bpjs.jp_k  * M : 0;

    const netto = bs - bj - jht_k_tahunan - jp_k_tahunan;
    const pkp = Math.max(0, Math.floor((netto - ptkp) / 1000) * 1000);
    let pth = getPasal17Tax(pkp);
    if (!k.punya_npwp) {
        pth = Math.round(pth * 1.2);
    }

    // Raw can be negative (over-withholding → refund); on-slip pph is clamped.
    const rawPph = Math.round(pth - k.pph_jan_nov);
    const isRefund = rawPph < 0;
    const refundAmount = isRefund ? -rawPph : 0;
    const pd = Math.max(0, rawPph);

    const tunj_pph = k.pph_ditanggung ? pd : 0;
    const pot_pph = k.pph_ditanggung ? 0 : pd;

    const thp = k.gaji_pokok + allowance_total - bpjs.karyawan_potong - pot_pph - k.kasbon - k.alpha_telat - k.pot_lain;

    const proyeksi = {
        bruto_setahun: bs,
        biaya_jabatan_setahun: bj,
        netto_setahun: netto,
        pkp_setahun: pkp,
        pph_setahun: pth,
        pph_jan_nov_proyeksi: k.pph_jan_nov,
        pph_desember_proyeksi: pd,
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
        bs, bj, jht_k_tahunan, jp_k_tahunan, netto, pkp, ptkp, pph_tahunan: pth,
        pph_jan_nov: k.pph_jan_nov,
        pph: pd, pot_pph, pph_ditanggung: k.pph_ditanggung,
        kasbon: k.kasbon, alpha_telat: k.alpha_telat, pot_lain: k.pot_lain,
        thp,
        proyeksi,
        is_last_month: true,
        months_in_year: M,
        raw_pph: rawPph,
        is_refund: isRefund,
        refund_amount: refundAmount,
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
    const basis = k.bpjs_basis ?? k.gaji_pokok;

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
        let pph_item = Math.max(0, Math.round(pph_dgn - pph_reg));

        if (!k.punya_npwp) {
            pph_item = Math.round(pph_item * 1.2);
        }

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

// ───────────────────────────────────────────────────────────────────────────
// Kompensasi (pesangon / penghargaan masa kerja / penggantian hak / manfaat
// pensiun) — PPh 21 final per PP 68/2009 progressive brackets.
// ───────────────────────────────────────────────────────────────────────────

export type KompensasiKategori = 'pesangon' | 'penghargaan' | 'manfaat_pensiun' | 'penggantian_hak' | 'other';

export interface KompensasiInput {
    nama: string;
    nik: string;
    npwp: string;
    punya_npwp: boolean;
    status_ptkp?: string;     // for reporting; PP 68/2009 doesn't consume PTKP
    divisi?: string;
    kategori: KompensasiKategori;
    jumlah_bruto: number;     // gross severance amount in Rp
}

export interface KompensasiBracketApplied {
    bracket_lo: number;   // lower bound of this bracket
    bracket_hi: number;   // upper bound (Infinity for top bracket)
    rate: number;         // 0, 0.05, 0.15, 0.25
    taxable: number;      // portion of jumlah_bruto falling in this bracket
    tax: number;          // = taxable × rate (before non-NPWP multiplier)
}

/**
 * Compute PPh 21 final on a one-off kompensasi payment using PP 68/2009
 * brackets. Returns the full bracket-by-bracket breakdown for transparency
 * (stored in result_json).
 *
 * Brackets are cumulative widths:
 *   first  Rp 50,000,000 → 0%
 *   next   Rp 50,000,000 → 5%   (50M..100M)
 *   next   Rp 400,000,000 → 15% (100M..500M)
 *   above  Rp 500,000,000 → 25%
 *
 * Non-NPWP: PPh × 1.2 per UU PPh Pasal 17 ayat (5). Applied to the final
 * total (not to each bracket individually).
 */
export function calculateSeverance(k: KompensasiInput) {
    const jumlah = Math.max(0, Math.floor(k.jumlah_bruto));
    const breakdown: KompensasiBracketApplied[] = [];

    let lo = 0;
    let remaining = jumlah;
    let pph_before_npwp = 0;

    for (const [width, rate] of PESANGON_BRACKETS) {
        const hi = lo + width;
        if (remaining <= 0) break;
        const taxable = Math.min(remaining, width);
        const tax = taxable * rate;
        breakdown.push({
            bracket_lo: lo,
            bracket_hi: hi === Infinity ? Infinity : hi,
            rate,
            taxable,
            tax,
        });
        pph_before_npwp += tax;
        remaining -= taxable;
        lo = hi;
    }

    const npwp_mult = k.punya_npwp ? 1.0 : 1.2;
    const pph = Math.round(pph_before_npwp * npwp_mult);
    const thp = jumlah - pph;

    return {
        jenis: 'KOMPENSASI (PPh 21 Final — PP 68/2009)',
        kategori: k.kategori,
        nama: k.nama,
        nik: k.nik,
        npwp: k.npwp,
        punya_npwp: k.punya_npwp,
        status_ptkp: k.status_ptkp ?? null,
        divisi: k.divisi ?? null,
        jumlah_bruto: jumlah,
        breakdown,
        pph_before_npwp_multiplier: Math.round(pph_before_npwp),
        npwp_multiplier: npwp_mult,
        pph,
        thp,
    };
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

        let total_pph = Math.round(total_upah * ter);
        if (!k.punya_npwp) {
            total_pph = Math.round(total_pph * 1.2);
        }

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
            if (!k.punya_npwp) {
                pph = Math.round(pph * 1.2);
            }
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
