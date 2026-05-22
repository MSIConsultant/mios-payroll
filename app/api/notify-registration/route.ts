import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEV_EMAIL      = 'msiconsultant.international@gmail.com';

// Kept public because it's called during registration before the user has a
// verified session. HTML-escape the email field before interpolation so a
// crafted body can't inject markup into the dev notification.
function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const rawEmail = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!rawEmail || rawEmail.length > 320) return NextResponse.json({ ok: false });
    if (!RESEND_API_KEY) return NextResponse.json({ ok: false });

    const safeEmail = escapeHtml(rawEmail);

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
            <p>Email baru terdaftar: <strong>${safeEmail}</strong></p>
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
