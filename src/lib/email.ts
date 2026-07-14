import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "AskZero <noreply@askzero.ai>";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function sendDepositConfirmation(
  to: string,
  amount: string,
  credits: number,
  currency: string
) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Deposit Confirmed — AskZero",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Payment Received</h2>
          <p style="margin: 0 0 24px; color: #666; font-size: 14px;">Your deposit has been processed successfully.</p>
          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px;">
            <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Amount</p>
            <p style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #111;">${amount} ${currency}</p>
            <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Credits Added</p>
            <p style="margin: 0; font-size: 24px; font-weight: 700; color: #111;">${credits.toLocaleString()}</p>
          </div>
          <p style="margin: 24px 0 0; font-size: 12px; color: #999;">AskZero — Decentralized AI for Everyone</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send deposit email:", err);
  }
}

export async function sendLowBalanceWarning(
  to: string,
  currentBalance: number
) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Low Balance Alert — AskZero",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Low Balance Warning</h2>
          <p style="margin: 0 0 24px; color: #666; font-size: 14px;">Your AskZero credit balance is running low.</p>
          <div style="background: #fff8e1; border-radius: 12px; padding: 20px;">
            <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Remaining Credits</p>
            <p style="margin: 0; font-size: 24px; font-weight: 700; color: #e65100;">${currentBalance.toLocaleString()}</p>
          </div>
          <a href="https://askzero.ai/deposit" style="display: inline-block; margin: 24px 0 0; background: #111; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Add Funds</a>
          <p style="margin: 24px 0 0; font-size: 12px; color: #999;">AskZero — Decentralized AI for Everyone</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send low balance email:", err);
  }
}

// Returns true only if an email was actually handed to Resend, so the caller
// (the re-engagement cron) can stamp/count sends and retry the rest.
export async function sendStreakNudge(
  to: string,
  displayName: string,
  streak: number,
  reward: number
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const name = displayName?.trim() ? displayName.trim().split(" ")[0] : "there";

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `🔥 Your ${streak}-day streak ends tonight`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Hey ${name}, don't lose your streak 🔥</h2>
          <p style="margin: 0 0 24px; color: #666; font-size: 14px;">You're on a <strong>${streak}-day</strong> streak. Claim today before midnight to keep it going — miss a day and it resets to zero.</p>
          <div style="background: #fff3e0; border-radius: 12px; padding: 20px; text-align: center;">
            <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Claim now and get</p>
            <p style="margin: 0; font-size: 28px; font-weight: 700; color: #e65100;">${reward.toLocaleString()} free credits</p>
          </div>
          <a href="https://askzero.ai/?claim=daily" style="display: inline-block; margin: 24px 0 0; background: #111; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Claim your credits</a>
          <p style="margin: 24px 0 0; font-size: 12px; color: #999;">AskZero — Decentralized AI for Everyone</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("Failed to send streak nudge email:", err);
    return false;
  }
}

export async function sendAccountDeletedConfirmation(to: string) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Account Deleted — AskZero",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Account Deleted</h2>
          <p style="margin: 0 0 24px; color: #666; font-size: 14px;">Your AskZero account and all associated data have been permanently deleted.</p>
          <p style="margin: 0; color: #666; font-size: 14px;">If this was a mistake, you can always create a new account at <a href="https://askzero.ai" style="color: #2563eb;">askzero.ai</a>.</p>
          <p style="margin: 24px 0 0; font-size: 12px; color: #999;">AskZero — Decentralized AI for Everyone</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send deletion email:", err);
  }
}
