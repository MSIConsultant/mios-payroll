'use server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'MIOS Payroll <onboarding@resend.dev>';
const DEV_EMAIL      = 'msiconsultant.international@gmail.com';

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
  // Notify dev that a new user needs approval
  return sendEmail({
    to:      DEV_EMAIL,
    subject: `[MIOS Payroll] Pengguna baru menunggu persetujuan`,
    html: `
      <div style="font-family: monospace; background: #0A0A0C; color: #E4E4E7; padding: 32px; border-radius: 12px;">
        <h2 style="color: #3B82F6; margin: 0 0 16px;">Pengguna Baru</h2>
        <p>Email: <strong>${userEmail}</strong></p>
        ${userName ? `<p>Nama: <strong>${userName}</strong></p>` : ''}
        <p style="margin-top: 24px;">
          <a href="https://mios-payroll.vercel.app/dev/admin"
            style="background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Buka Dev Panel →
          </a>
        </p>
        <p style="color: #52525B; font-size: 12px; margin-top: 24px;">MIOS Payroll · msiconsultant.international@gmail.com</p>
      </div>
    `,
  });
}

export async function notifyUserApproved(userEmail: string, role: string) {
  return sendEmail({
    to:      userEmail,
    subject: `[MIOS Payroll] Akun Anda telah disetujui`,
    html: `
      <div style="font-family: monospace; background: #0A0A0C; color: #E4E4E7; padding: 32px; border-radius: 12px;">
        <h2 style="color: #4ADE80; margin: 0 0 16px;">✓ Akun Disetujui</h2>
        <p>Akun Anda telah disetujui sebagai <strong>${role === 'accountant' ? 'Akuntan' : 'Staff'}</strong>.</p>
        <p style="margin-top: 24px;">
          <a href="https://mios-payroll.vercel.app/dashboard"
            style="background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Buka Dashboard →
          </a>
        </p>
        <p style="color: #52525B; font-size: 12px; margin-top: 24px;">MIOS Payroll · Internal MSI Consultant International</p>
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
  const BULAN = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return sendEmail({
    to:      accountantEmail,
    subject: `[MIOS Payroll] Payroll dikunci — ${companyName} ${BULAN[bulan]} ${tahun}`,
    html: `
      <div style="font-family: monospace; background: #0A0A0C; color: #E4E4E7; padding: 32px; border-radius: 12px;">
        <h2 style="color: #4ADE80; margin: 0 0 16px;">🔒 Payroll Dikunci</h2>
        <p>Payroll <strong>${companyName}</strong> untuk periode <strong>${BULAN[bulan]} ${tahun}</strong> telah dikunci.</p>
        <p style="color: #A1A1AA;">Dikunci oleh: ${lockedBy}</p>
        <p style="margin-top: 24px;">
          <a href="https://mios-payroll.vercel.app/dashboard"
            style="background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Lihat Dashboard →
          </a>
        </p>
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
