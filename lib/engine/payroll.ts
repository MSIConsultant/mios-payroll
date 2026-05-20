import { PTKP, PTKP_TER_GRUP, PASAL17, TER, BPJS, JP_MAX_BASIS, KES_MAX_BASIS, BIAYA_JAB_RATE, BIAYA_JAB_MAX } from "./constants";

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

    if (k.bulan === 12) {
        return calculateDecember(k, bpjs, allowance_total, base, grup, k.akum_bruto);
    }

    const npwp_mult = !k.punya_npwp ? 1.2 : 1.0;
    let pph = 0;
    let tunj_pph = 0;
    let pot_pph = 0;

    if (k.pph_ditanggung) {
        let prev = -1.0;
        let iterConverged = false;
        for (let i = 0; i < 200; i++) {
            const t = getTerRate(base + pph, grup);
            if (t === 0) {
                pph = 0.0;
                iterConverged = true;
                break;
            }
            const mt = npwp_mult * t;
            if (mt >= 1.0) break;
            const n = (mt * base) / (1 - mt);
            if (Math.abs(n - prev) < 0.01) {
                pph = Math.round((n + prev) / 2);
                iterConverged = true;
                break;
            }
            if (Math.abs(n - pph) < 0.01) {
                pph = Math.round(n);
                iterConverged = true;
                break;
            }
            prev = pph;
            pph = n;
        }
        if (!iterConverged) {
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
    };
}

export function calculateDecember(k: KaryawanTetap, bpjs: ReturnType<typeof calculateBPJS>, allowance_total: number, base: number, grup: "A" | "B" | "C", akum_bruto: number = 0) {
    const ptkp = PTKP[k.status_ptkp];
    const bs = akum_bruto > 0 ? (akum_bruto + base) : (base * 12);
    const bj = Math.min(bs * BIAYA_JAB_RATE, BIAYA_JAB_MAX * 12);
    const jp_k_tahunan = !k.tanggung_jp_k ? bpjs.jp_k * 12 : 0;
    const netto = bs - bj - jp_k_tahunan;
    const pkp = Math.max(0, Math.floor((netto - ptkp) / 1000) * 1000);
    let pth = getPasal17Tax(pkp);
    if (!k.punya_npwp) {
        pth = Math.round(pth * 1.2);
    }
    const pd = Math.max(0, Math.round(pth - k.pph_jan_nov));

    const tunj_pph = k.pph_ditanggung ? pd : 0;
    const pot_pph = k.pph_ditanggung ? 0 : pd;

    const thp = k.gaji_pokok + allowance_total - bpjs.karyawan_potong - pot_pph - k.kasbon - k.alpha_telat - k.pot_lain;

    return {
        jenis: "GAJI — DESEMBER (Equalisasi Pasal 17)",
        bulan: 12, tahun: k.tahun,
        grup, ter: null, status_ptkp: k.status_ptkp,
        basis: k.gaji_pokok, bpjs,
        gaji_pokok: k.gaji_pokok, allowance_total,
        benefit: k.benefit, kendaraan: k.kendaraan,
        pulsa: k.pulsa, operasional: k.operasional, tunj_lain: k.tunj_lain,
        tunj_pph, base, bruto: base + tunj_pph,
        bs, bj, jp_k_tahunan, netto, pkp, ptkp, pph_tahunan: pth,
        pph_jan_nov: k.pph_jan_nov,
        pph: pd, pot_pph, pph_ditanggung: k.pph_ditanggung,
        kasbon: k.kasbon, alpha_telat: k.alpha_telat, pot_lain: k.pot_lain,
        thp,
    };
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

export function calculateFreelance(k: KaryawanTidakTetap) {
    const ptkp = PTKP[k.status_ptkp];

    if (k.mode === "harian") {
        const BATAS_HARIAN = 450_000;
        const upah_reg = k.upah_harian * k.hari_kerja;
        const total_upah = upah_reg + (k.thr || 0) + (k.bonus || 0);
        let pph_per_hari = 0;
        let keterangan = "";
        
        if (k.upah_harian <= BATAS_HARIAN) {
            keterangan = `Upah harian Rp ${k.upah_harian} <= Rp ${BATAS_HARIAN} -> PPh Nihil`;
        } else {
            const ptkp_per_hari = ptkp / 360;
            const pkp_per_hari = Math.max(0, k.upah_harian - ptkp_per_hari);
            pph_per_hari = pkp_per_hari * 0.05;
            keterangan = "5% x (upah harian - PTKP/360)";
        }
        
        if (!k.punya_npwp) {
            pph_per_hari *= 1.2;
        }
        
        const total_pph = Math.round(pph_per_hari * k.hari_kerja);
        const thp = total_upah - total_pph - k.kasbon - k.pot_lain;
        
        return {
            mode: "harian", status_ptkp: k.status_ptkp,
            upah_harian: k.upah_harian, hari_kerja: k.hari_kerja,
            total_upah, ptkp_harian: +(ptkp / 360).toFixed(2),
            pph_per_hari: Math.round(pph_per_hari), total_pph,
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
