import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export interface HeirEmailPayload {
  to: string;
  name?: string;
  share: number;
  ownerAddress: string;
  claimUrl: string;
}

function buildEmailHtml(p: HeirEmailPayload): string {
  const greeting = p.name ? `Dear ${p.name},` : "Dear Recipient,";
  const shareText = `${p.share}%`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>You have received a digital inheritance</title>
</head>
<body style="margin:0;padding:0;background:#030303;font-family:Georgia,'Times New Roman',serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#030303;min-height:100vh;">
  <tr>
    <td align="center" style="padding:48px 16px;">

      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Logo / Brand -->
        <tr>
          <td style="padding-bottom:52px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;font-weight:400;letter-spacing:0.3em;color:rgba(255,255,255,0.25);text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Inter',system-ui,sans-serif;">
              AFTERLIFE
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:rgba(255,255,255,0.12);letter-spacing:0.15em;font-family:monospace;">
              Decentralized Inheritance Protocol · Solana
            </p>
          </td>
        </tr>

        <!-- Spacer -->
        <tr><td style="height:48px;"></td></tr>

        <!-- Main heading -->
        <tr>
          <td style="padding-bottom:32px;">
            <h1 style="margin:0;font-size:36px;font-weight:300;line-height:1.25;letter-spacing:-0.02em;color:rgba(255,255,255,0.92);">
              You have been designated<br/>as an heir.
            </h1>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding-bottom:20px;">
            <p style="margin:0;font-size:16px;line-height:1.75;color:rgba(255,255,255,0.55);">
              ${greeting}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding-bottom:20px;">
            <p style="margin:0;font-size:16px;line-height:1.75;color:rgba(255,255,255,0.55);">
              We are writing to inform you that you have been designated as a beneficiary in a digital inheritance arrangement created through <strong style="color:rgba(255,255,255,0.8);font-weight:600;">Afterlife</strong> — a secure, decentralized inheritance protocol built on the Solana blockchain.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding-bottom:40px;">
            <p style="margin:0;font-size:16px;line-height:1.75;color:rgba(255,255,255,0.55);">
              The person who created this arrangement has designated you to receive <strong style="color:rgba(255,255,255,0.9);font-weight:600;">${shareText} of their secured digital assets</strong>.
              The protocol has been automatically activated, and your portion is now ready to be claimed.
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding-bottom:40px;border-top:1px solid rgba(255,255,255,0.06);"></td>
        </tr>

        <!-- What this means -->
        <tr>
          <td style="padding-bottom:16px;">
            <h2 style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Inter',system-ui,sans-serif;">
              What does this mean?
            </h2>
          </td>
        </tr>

        <tr>
          <td style="padding-bottom:40px;">
            <p style="margin:0;font-size:15px;line-height:1.75;color:rgba(255,255,255,0.45);">
              Unlike traditional inheritance, digital assets are secured directly in a smart contract on the blockchain — no lawyers, no banks, no waiting periods. To claim your assets, simply click the button below and follow the guided steps on our platform.
            </p>
          </td>
        </tr>

        <!-- Info cards -->
        <tr>
          <td style="padding-bottom:40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:33%;padding:0 6px 0 0;vertical-align:top;">
                  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;">
                    <p style="margin:0 0 6px;font-size:18px;">🔐</p>
                    <p style="margin:0;font-size:12px;font-weight:600;color:rgba(255,255,255,0.6);font-family:-apple-system,BlinkMacSystemFont,sans-serif;">Secure</p>
                    <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">Assets are held in a tamper-proof smart contract</p>
                  </div>
                </td>
                <td style="width:33%;padding:0 3px;vertical-align:top;">
                  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;">
                    <p style="margin:0 0 6px;font-size:18px;">⚡</p>
                    <p style="margin:0;font-size:12px;font-weight:600;color:rgba(255,255,255,0.6);font-family:-apple-system,BlinkMacSystemFont,sans-serif;">Fast</p>
                    <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">Claim your assets in minutes, no paperwork needed</p>
                  </div>
                </td>
                <td style="width:33%;padding:0 0 0 6px;vertical-align:top;">
                  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;">
                    <p style="margin:0 0 6px;font-size:18px;">🌐</p>
                    <p style="margin:0;font-size:12px;font-weight:600;color:rgba(255,255,255,0.6);font-family:-apple-system,BlinkMacSystemFont,sans-serif;">Guided</p>
                    <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">New to crypto? We'll walk you through every step</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding-bottom:48px;text-align:center;">
            <a href="${p.claimUrl}" style="display:inline-block;background:#ffffff;color:#000000;padding:17px 44px;border-radius:100px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.02em;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Inter',system-ui,sans-serif;">
              Claim Your Inheritance &rarr;
            </a>
            <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.2);font-family:monospace;">
              ${p.claimUrl}
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding-bottom:32px;border-top:1px solid rgba(255,255,255,0.06);"></td>
        </tr>

        <!-- No wallet note -->
        <tr>
          <td style="padding-bottom:16px;">
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.5);font-family:-apple-system,BlinkMacSystemFont,sans-serif;">Don't have a crypto wallet?</p>
              <p style="margin:0;font-size:13px;line-height:1.65;color:rgba(255,255,255,0.3);font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
                No problem. When you click the claim link, you'll have the option to create a secure wallet using just your email address. We'll then guide you on how to access it through popular apps like Phantom.
              </p>
            </div>
          </td>
        </tr>

        <!-- Spacer -->
        <tr><td style="height:48px;"></td></tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid rgba(255,255,255,0.05);padding-top:32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.15);letter-spacing:0.15em;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
              AFTERLIFE · Decentralized Inheritance Protocol
            </p>
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.1);font-family:monospace;">
              Owner: ${p.ownerAddress.slice(0, 8)}...${p.ownerAddress.slice(-6)}
            </p>
            <p style="margin:12px 0 0;font-size:11px;color:rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
              You received this email because you were designated as an heir in an Afterlife inheritance protocol. If you believe this was sent in error, you can safely ignore it.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  const resend = new Resend(apiKey);

  try {
    const payload: HeirEmailPayload = await req.json();

    const { error } = await resend.emails.send({
      from: "Afterlife Protocol <onboarding@resend.dev>",
      to: payload.to,
      subject: `${payload.name ? payload.name + ", your" : "Your"} Afterlife inheritance is ready to claim`,
      html: buildEmailHtml(payload),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
