import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import {
  type LegacyStrategy,
  STRATEGY_META,
  strategyHumanSummary,
  protectedSchedule,
  monthlyPayout,
  decodeStrategyFromUrl,
} from "@/lib/legacy";

export interface HeirEmailPayload {
  to: string;
  name?: string;
  share: number;
  ownerAddress: string;
  claimUrl: string;
}

function tryDecodeStrategyFromUrl(url: string): LegacyStrategy | null {
  try {
    const u = new URL(url);
    const s = u.searchParams.get("s");
    return s ? decodeStrategyFromUrl(s) : null;
  } catch {
    return null;
  }
}

function strategyEmailDetail(strategy: LegacyStrategy, sharePercent: number): { label: string; value: string; sub: string } {
  if (strategy.kind === "protected") {
    const sched = protectedSchedule(strategy, sharePercent / 100);
    return {
      label: "First Unlock",
      value: `${sched.unlockPercent.toFixed(2)}%`,
      sub: `Then ${strategy.unlockFrequency} for ${strategy.vestingYears} ${strategy.vestingYears === 1 ? "year" : "years"} (${sched.totalPeriods} unlocks)`,
    };
  }
  if (strategy.kind === "generational") {
    const payout = monthlyPayout(strategy, sharePercent / 100);
    return {
      label: `Estimated ${strategy.payoutFrequency} payout`,
      value: `~${(payout * 100).toFixed(2)}%`,
      sub: `Principal preserved · ${strategy.estimatedApy}% APY (projected)`,
    };
  }
  if (strategy.kind === "custom") {
    return { label: "Strategy", value: "Custom", sub: "Programmable inheritance rules" };
  }
  return { label: "Available now", value: "100%", sub: "Full share, single transfer" };
}

function buildEmailHtml(p: HeirEmailPayload): string {
  const greeting = p.name ? `Hi ${p.name},` : "Hello,";
  const shareText = `${p.share}%`;
  const strategy = tryDecodeStrategyFromUrl(p.claimUrl);
  const strategyMeta = strategy ? STRATEGY_META[strategy.kind] : null;
  const strategyDetail = strategy ? strategyEmailDetail(strategy, p.share) : null;
  const strategySummary = strategy ? strategyHumanSummary(strategy) : null;

  const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Helvetica Neue', Arial, sans-serif";
  const MONO = "'SF Mono', 'JetBrains Mono', 'Courier New', monospace";
  const GOLD = "#b08020";
  const GOLD_LIGHT = "#fdf7e8";
  const INK = "#0d0d0d";
  const SOFT_INK = "#5b5b5b";
  const HAIRLINE = "#ececec";
  const PAPER = "#fafaf7";

  const strategyBlock = strategy && strategyMeta && strategyDetail
    ? `
        <!-- Inheritance Plan -->
        <tr>
          <td style="padding:8px 36px 32px;">
            <div style="border:1px solid ${HAIRLINE};border-radius:16px;overflow:hidden;background:#ffffff;">
              <div style="padding:18px 22px;border-bottom:1px solid ${HAIRLINE};">
                <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${SOFT_INK};font-family:${SANS};">
                  Inheritance Plan
                </p>
                <p style="margin:6px 0 0;font-size:18px;font-weight:600;color:${INK};letter-spacing:-0.01em;font-family:${SANS};">
                  ${strategyMeta.title}
                </p>
                <p style="margin:4px 0 0;font-size:13px;color:${SOFT_INK};line-height:1.55;font-family:${SANS};">
                  ${strategySummary}
                </p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:${GOLD_LIGHT};">
                <tr>
                  <td style="padding:18px 22px;width:50%;vertical-align:top;border-right:1px solid ${HAIRLINE};">
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${GOLD};font-family:${SANS};">
                      ${strategyDetail.label}
                    </p>
                    <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:${INK};letter-spacing:-0.02em;font-family:${SANS};">
                      ${strategyDetail.value}
                    </p>
                  </td>
                  <td style="padding:18px 22px;width:50%;vertical-align:top;">
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${GOLD};font-family:${SANS};">
                      Schedule
                    </p>
                    <p style="margin:6px 0 0;font-size:13px;color:${INK};line-height:1.5;font-family:${SANS};">
                      ${strategyDetail.sub}
                    </p>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
      `
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>An inheritance is ready for you</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${SANS};color:${INK};-webkit-font-smoothing:antialiased;">

<!-- Preheader (hidden) -->
<div style="display:none;font-size:1px;color:${PAPER};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${p.name ? p.name + ", an" : "An"} Afterlife inheritance is ready for you to claim — ${shareText} of the digital assets.
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:24px;overflow:hidden;">

        <!-- Brand bar -->
        <tr>
          <td style="padding:24px 36px;border-bottom:1px solid ${HAIRLINE};">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK};font-family:${SANS};">
                    Afterlife
                  </p>
                  <p style="margin:2px 0 0;font-size:10px;color:${SOFT_INK};letter-spacing:0.12em;font-family:${MONO};">
                    Inheritance Protocol · Solana
                  </p>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;background:${GOLD_LIGHT};color:${GOLD};border:1px solid ${GOLD};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:5px 10px;border-radius:100px;font-family:${SANS};">
                    Ready to claim
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:44px 36px 8px;">
            <h1 style="margin:0;font-size:30px;font-weight:600;line-height:1.2;letter-spacing:-0.02em;color:${INK};font-family:${SANS};">
              An inheritance<br/>has been left for you.
            </h1>
            <p style="margin:18px 0 0;font-size:15px;line-height:1.65;color:${SOFT_INK};font-family:${SANS};">
              ${greeting} you've been designated as a beneficiary in a digital inheritance arrangement on Afterlife — a decentralized, non-custodial protocol on Solana.
            </p>
          </td>
        </tr>

        <!-- Share card -->
        <tr>
          <td style="padding:32px 36px 8px;">
            <div style="border:1px solid ${HAIRLINE};border-radius:18px;padding:28px 26px;background:#ffffff;text-align:center;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${SOFT_INK};font-family:${SANS};">
                Your share
              </p>
              <p style="margin:10px 0 0;font-size:56px;font-weight:700;letter-spacing:-0.04em;color:${INK};line-height:1;font-family:${SANS};">
                ${shareText}
              </p>
              <p style="margin:10px 0 0;font-size:13px;color:${SOFT_INK};line-height:1.55;font-family:${SANS};">
                of the secured digital assets in this vault
              </p>
            </div>
          </td>
        </tr>

        ${strategyBlock}

        <!-- CTA -->
        <tr>
          <td style="padding:${strategy ? "0" : "20"}px 36px 8px;text-align:center;">
            <a href="${p.claimUrl}" style="display:inline-block;background:${INK};color:#ffffff;padding:16px 38px;border-radius:100px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.01em;font-family:${SANS};">
              Claim your inheritance →
            </a>
            <p style="margin:14px 0 0;font-size:11px;color:${SOFT_INK};line-height:1.5;font-family:${SANS};">
              No gas fees. The protocol covers the transaction for you.
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:36px 36px 0;">
            <div style="height:1px;background:${HAIRLINE};"></div>
          </td>
        </tr>

        <!-- How it works -->
        <tr>
          <td style="padding:28px 36px 8px;">
            <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${SOFT_INK};font-family:${SANS};">
              How this works
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:14px;vertical-align:top;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:24px;vertical-align:top;padding-top:1px;">
                        <div style="width:18px;height:18px;border-radius:50%;background:${GOLD_LIGHT};border:1px solid ${GOLD};color:${GOLD};font-size:10px;font-weight:700;text-align:center;line-height:18px;font-family:${SANS};">1</div>
                      </td>
                      <td style="padding-left:12px;vertical-align:top;">
                        <p style="margin:0;font-size:14px;font-weight:600;color:${INK};font-family:${SANS};">Click the claim button above</p>
                        <p style="margin:3px 0 0;font-size:13px;color:${SOFT_INK};line-height:1.55;font-family:${SANS};">You'll arrive at a secure page on afterlife-sol.vercel.app.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:14px;vertical-align:top;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:24px;vertical-align:top;padding-top:1px;">
                        <div style="width:18px;height:18px;border-radius:50%;background:${GOLD_LIGHT};border:1px solid ${GOLD};color:${GOLD};font-size:10px;font-weight:700;text-align:center;line-height:18px;font-family:${SANS};">2</div>
                      </td>
                      <td style="padding-left:12px;vertical-align:top;">
                        <p style="margin:0;font-size:14px;font-weight:600;color:${INK};font-family:${SANS};">Connect a wallet, or create one with your email</p>
                        <p style="margin:3px 0 0;font-size:13px;color:${SOFT_INK};line-height:1.55;font-family:${SANS};">New to crypto? We'll create a wallet for you in 30 seconds — no downloads.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="vertical-align:top;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:24px;vertical-align:top;padding-top:1px;">
                        <div style="width:18px;height:18px;border-radius:50%;background:${GOLD_LIGHT};border:1px solid ${GOLD};color:${GOLD};font-size:10px;font-weight:700;text-align:center;line-height:18px;font-family:${SANS};">3</div>
                      </td>
                      <td style="padding-left:12px;vertical-align:top;">
                        <p style="margin:0;font-size:14px;font-weight:600;color:${INK};font-family:${SANS};">Verify your email and receive your assets</p>
                        <p style="margin:3px 0 0;font-size:13px;color:${SOFT_INK};line-height:1.55;font-family:${SANS};">The protocol verifies you on-chain and transfers your share directly to your wallet.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Link fallback -->
        <tr>
          <td style="padding:28px 36px 24px;">
            <div style="background:${PAPER};border:1px solid ${HAIRLINE};border-radius:12px;padding:14px 16px;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${SOFT_INK};font-family:${SANS};">
                Button not working?
              </p>
              <p style="margin:0;font-size:11px;color:${INK};line-height:1.5;font-family:${MONO};word-break:break-all;">
                ${p.claimUrl}
              </p>
            </div>
          </td>
        </tr>

      </table>

      <!-- Footer -->
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding:24px 36px;text-align:center;">
            <p style="margin:0;font-size:11px;color:${SOFT_INK};letter-spacing:0.12em;text-transform:uppercase;font-family:${SANS};">
              Afterlife · Inheritance Protocol on Solana
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:${SOFT_INK};font-family:${MONO};">
              Vault owner: ${p.ownerAddress.slice(0, 8)}…${p.ownerAddress.slice(-6)}
            </p>
            <p style="margin:14px 0 0;font-size:11px;color:${SOFT_INK};line-height:1.55;font-family:${SANS};">
              You received this email because the vault owner designated you as a beneficiary. If you believe this was sent in error, you can safely ignore it — no action will be taken on your behalf without your wallet signature.
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
  const smtpUser = process.env.GMAIL_USER;
  const smtpPass = process.env.GMAIL_APP_PASSWORD;
  if (!smtpUser || !smtpPass) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    const payload: HeirEmailPayload = await req.json();

    const subjectName = payload.name?.trim();
    const subject = subjectName
      ? `${subjectName}, an inheritance is ready for you`
      : "An inheritance is ready for you";

    await transporter.sendMail({
      from: `"Afterlife" <${smtpUser}>`,
      to: payload.to,
      subject,
      html: buildEmailHtml(payload),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
