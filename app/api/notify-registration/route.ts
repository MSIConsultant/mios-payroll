import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEV_EMAIL      = 'msiconsultant.international@gmail.com';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!RESEND_API_KEY) return NextResponse.json({ ok: false });

    await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'MIOS Payroll <onboarding@resend.dev>',
        to:      DEV_EMAIL,
        subject: '[MIOS Payroll] Pengguna baru menunggu persetujuan',
        html: `
          <div style="font-family:monospace;background:#0A0A0C;color:#E4E4E7;padding:32px;border-radius:12px;">
            <h2 style="color:#3B82F6;margin:0 0 16px;">Pengguna Baru</h2>
            <p>Email baru terdaftar: <strong>${email}</strong></p>
            <p>Akun ini menunggu persetujuan Anda.</p>
            <p style="margin-top:24px;">
              <a href="https://mios-payroll.vercel.app/dev/admin"
                style="background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                Buka Dev Panel →
              </a>
            </p>
          </div>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
