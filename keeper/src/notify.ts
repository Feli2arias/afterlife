import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = "Vigil <noreply@vigil.app>";

export async function sendWarningEmail(to: string, ownerWallet: string, daysLeft: number) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Vigil: tu check-in vence en ${daysLeft} días`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#10b981">Vigil</h2>
        <p>Tu check-in vence en <strong>${daysLeft} días</strong>.</p>
        <p>Si no confirmás que seguís activo, tus activos serán distribuidos a tus beneficiarios.</p>
        <a href="https://vigil.app/dashboard" style="display:inline-block;background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">
          Confirmar ahora
        </a>
        <p style="color:#666;font-size:12px;margin-top:32px">Wallet: ${ownerWallet}</p>
      </div>
    `,
  });
}

export async function sendBeneficiaryEmail(
  to: string,
  ownerWallet: string,
  sharePercent: number,
  claimUrl: string
) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Vigil: tenés activos disponibles para reclamar`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#10b981">Vigil</h2>
        <p>El titular de la wallet <strong>${ownerWallet.slice(0, 8)}...</strong> ha designado que recibas el <strong>${sharePercent}%</strong> de sus activos.</p>
        <a href="${claimUrl}" style="display:inline-block;background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">
          Reclamar activos
        </a>
      </div>
    `,
  });
}
