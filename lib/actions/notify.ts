'use server';
import { getAppUrl } from '@/lib/env';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Set RESEND_FROM_EMAIL in Vercel env to use a verified custom domain.
// Falls back to Resend's shared sandbox domain for development.
const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL ?? 'MIOS Payroll <onboarding@resend.dev>';
const DEV_EMAIL   = 'msiconsultant.international@gmail.com';

interface SendEmailParams {
  to:      string;
  subject: string;
  html:    string;
}

async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!RESEND_API_KEY) {
    console.warn('[notify] RESEND_API_KEY not set — email skipped');
    return { success: false };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[notify] Resend error:', err);
      return { success: false };
    }
    return { success: true };
  } catch (err) {
    console.error('[notify] fetch error:', err);
    return { success: false };
  }
}

// ── Email templates ───────────────────────────────────────────────

export async function notifyPendingApproval(userEmail: string, userName?: string) {
  const appUrl   = getAppUrl() ?? 'https://mios-payroll.vercel.app';
  const adminUrl = `${appUrl}/dev/admin`;
  const now      = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' });

  return sendEmail({
    to:      DEV_EMAIL,
    subject: `[MIOS Payroll] Pengguna baru: ${userEmail}`,
    html: `
      <div style="font-family: system-ui, sans-serif; background: #F6F7F9; padding: 40px; border-radius: 12px; max-width: 520px; margin: 0 auto;">
        <div style="background: white; border-radius: 10px; padding: 32px; border: 1px solid #E5E7EB;">
          <h2 style="color: #0F172A; margin: 0 0 6px; font-size: 18px;">Pengguna Baru Menunggu Persetujuan</h2>
          <p style="color: #64748B; margin: 0 0 24px; font-size: 14px;">${now} WIB</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 8px 0; color: #64748B; font-size: 13px; width: 80px;">Email</td>
              <td style="padding: 8px 0; color: #0F172A; font-size: 13px; font-weight: 600;">${userEmail}</td>
            </tr>
            ${userName ? `<tr>
              <td style="padding: 8px 0; color: #64748B; font-size: 13px;">Nama</td>
              <td style="padding: 8px 0; color: #0F172A; font-size: 13px;">${userName}</td>
            </tr>` : ''}
          </table>

          <a href="${adminUrl}"
            style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Buka Admin Panel →
          </a>
          <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; margin-bottom: 0;">
            Setujui atau tolak dari tab <strong>Pending</strong> di admin panel.
          </p>
        </div>
        <p style="color: #94A3B8; font-size: 11px; margin-top: 16px; text-align: center;">MIOS Payroll</p>
      </div>
    `,
  });
}

export async function notifyUserApproved(userEmail: string, role: string) {
  const appUrl = getAppUrl() ?? 'https://mios-payroll.vercel.app';
  return sendEmail({
    to:      userEmail,
    subject: `[MIOS Payroll] Akun Anda telah disetujui`,
    html: `
      <div style="font-family: system-ui, sans-serif; background: #F6F7F9; padding: 40px; border-radius: 12px; max-width: 520px; margin: 0 auto;">
        <div style="background: white; border-radius: 10px; padding: 32px; border: 1px solid #E5E7EB;">
          <h2 style="color: #0F172A; margin: 0 0 16px; font-size: 18px;">✓ Akun Disetujui</h2>
          <p style="color: #334155; font-size: 14px; margin: 0 0 24px;">
            Akun Anda telah disetujui sebagai <strong>${role === 'accountant' ? 'Akuntan' : 'Staff'}</strong>.
            Anda dapat masuk dan mulai menggunakan MIOS Payroll.
          </p>
          <a href="${appUrl}/dashboard"
            style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Buka Dashboard →
          </a>
        </div>
        <p style="color: #94A3B8; font-size: 11px; margin-top: 16px; text-align: center;">MIOS Payroll · MSI Consultant International</p>
      </div>
    `,
  });
}

export async function notifyUserRejected(userEmail: string, reason: string) {
  return sendEmail({
    to:      userEmail,
    subject: `[MIOS Payroll] Permohonan akun tidak disetujui`,
    html: `
      <div style="font-family: monospace; background: #0A0A0C; color: #E4E4E7; padding: 32px; border-radius: 12px;">
        <h2 style="color: #EF4444; margin: 0 0 16px;">✗ Akun Tidak Disetujui</h2>
        <p>Permohonan akun Anda tidak dapat disetujui.</p>
        ${reason ? `<p>Alasan: <strong>${reason}</strong></p>` : ''}
        <p style="color: #52525B; font-size: 12px; margin-top: 24px;">Hubungi administrator jika ada pertanyaan.</p>
      </div>
    `,
  });
}

export async function notifyPayrollLocked(
  accountantEmail: string,
  companyName:     string,
  bulan:           number,
  tahun:           number,
  lockedBy:        string,
) {
  const BULAN  = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const appUrl = getAppUrl() ?? 'https://mios-payroll.vercel.app';
  return sendEmail({
    to:      accountantEmail,
    subject: `[MIOS Payroll] Payroll dikunci — ${companyName} ${BULAN[bulan]} ${tahun}`,
    html: `
      <div style="font-family: system-ui, sans-serif; background: #F6F7F9; padding: 40px; border-radius: 12px; max-width: 520px; margin: 0 auto;">
        <div style="background: white; border-radius: 10px; padding: 32px; border: 1px solid #E5E7EB;">
          <h2 style="color: #0F172A; margin: 0 0 16px; font-size: 18px;">🔒 Payroll Dikunci</h2>
          <p style="color: #334155; font-size: 14px; margin: 0 0 8px;">
            Payroll <strong>${companyName}</strong> periode <strong>${BULAN[bulan]} ${tahun}</strong> telah dikunci.
          </p>
          <p style="color: #64748B; font-size: 13px; margin: 0 0 24px;">Dikunci oleh: ${lockedBy}</p>
          <a href="${appUrl}/dashboard"
            style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Lihat Dashboard →
          </a>
        </div>
        <p style="color: #94A3B8; font-size: 11px; margin-top: 16px; text-align: center;">MIOS Payroll</p>
      </div>
    `,
  });
}

export async function notifyImportComplete(
  accountantEmail: string,
  companyName:     string,
  bulan:           number,
  tahun:           number,
  stats:           { created: number; skipped: number; diffs: number },
) {
  const BULAN = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return sendEmail({
    to:      accountantEmail,
    subject: `[MIOS Payroll] Import selesai — ${companyName} ${BULAN[bulan]} ${tahun}`,
    html: `
      <div style="font-family: monospace; background: #0A0A0C; color: #E4E4E7; padding: 32px; border-radius: 12px;">
        <h2 style="color: #3B82F6; margin: 0 0 16px;">📥 Import Selesai</h2>
        <p>Import <strong>${companyName}</strong> — ${BULAN[bulan]} ${tahun}</p>
        <table style="margin-top: 16px; border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 6px 0; color: #A1A1AA;">Karyawan baru</td><td style="color: #4ADE80; font-weight: bold;">${stats.created}</td></tr>
          <tr><td style="padding: 6px 0; color: #A1A1AA;">Sudah ada</td><td style="color: #71717A;">${stats.skipped}</td></tr>
          <tr><td style="padding: 6px 0; color: #A1A1AA;">Perbedaan rekonsiliasi</td><td style="color: ${stats.diffs > 0 ? '#FBB040' : '#4ADE80'};">${stats.diffs}</td></tr>
        </table>
      </div>
    `,
  });
}
