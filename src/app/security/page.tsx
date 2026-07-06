import Link from "next/link";
import { ArrowLeft, ShieldCheck, Mail } from "lucide-react";

export const metadata = {
  title: "Security & Privacy — AskZero",
  description:
    "How AskZero protects your data, and how to responsibly report a security vulnerability.",
};

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link
        href="/chat"
        className="press mb-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-text-tertiary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AskZero
      </Link>

      <div className="mb-3 flex items-center gap-2 text-accent">
        <ShieldCheck className="h-5 w-5" />
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">
          Security &amp; Privacy
        </span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Keeping your data safe
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
        We take the security and privacy of your conversations, memory, and funds
        seriously. This page summarizes our protections and how to report a
        vulnerability responsibly.
      </p>

      <div className="mt-10 space-y-9">
        <Block title="How your data is protected">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Every user-data table enforces <b>row-level security</b> — your
              chats, messages, and memories are only ever accessible to your
              account.
            </li>
            <li>
              <b>Payment card details never touch our servers</b> — deposits are
              processed entirely by Stripe and Paystack.
            </li>
            <li>
              Secrets and keys stay server-side; the app only ever holds public,
              rules-protected keys.
            </li>
            <li>
              AI inference receipts are anchored on 0G for tamper-evident,
              verifiable logs.
            </li>
            <li>
              You can permanently delete your account and all associated data at
              any time from Settings.
            </li>
          </ul>
        </Block>

        <Block title="Reporting a vulnerability">
          <p>
            If you believe you&apos;ve found a security issue, please report it
            privately — <b>do not open a public issue</b>. Include clear
            reproduction steps and the affected area (web, mobile, API, or
            on-chain).
          </p>
          <a
            href="mailto:security@askzerochat.xyz?subject=Security%20report"
            className="press mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
          >
            <Mail className="h-4 w-4" />
            security@askzerochat.xyz
          </a>
        </Block>

        <Block title="Our commitment">
          <p>
            We acknowledge reports within <b>3 business days</b>, provide an
            initial assessment within <b>7</b>, and practice coordinated
            disclosure. We&apos;re happy to credit researchers for valid, in-scope
            findings.
          </p>
        </Block>

        <Block title="Responsible testing">
          <p>
            Good-faith research is welcome and authorized. Please only access
            accounts you own, avoid denial-of-service and real-payment testing,
            and never access or retain other users&apos; data. Full terms are in
            our{" "}
            <a
              href="https://github.com/"
              className="text-accent underline-offset-4 hover:underline"
            >
              security policy
            </a>
            .
          </p>
        </Block>
      </div>
    </main>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-semibold text-foreground">{title}</h2>
      <div className="text-[14px] leading-relaxed text-text-secondary">
        {children}
      </div>
    </section>
  );
}
