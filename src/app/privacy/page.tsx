import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — AskZero",
  description:
    "What AskZero collects, where it goes, what leaves permanently, and how to delete it.",
};

// Last substantive revision. Update whenever the practices below change —
// a privacy policy that silently drifts from the code is worse than none.
const UPDATED = "31 August 2026";

export default function PrivacyPage() {
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
        <Lock className="h-5 w-5" />
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">
          Privacy Policy
        </span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        What we collect, and what leaves for good
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
        AskZero writes some data to a public blockchain, and that part cannot be
        deleted by anyone, including us. That is unusual, so it is stated plainly
        below rather than buried. Last updated {UPDATED}.
      </p>

      <div className="mt-10 space-y-9">
        <Block title="What we collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Account details</b> — your email address, and if you sign in
              with Google, the name and profile picture on that Google account.
            </li>
            <li>
              <b>Your conversations</b> — the messages you send, the answers you
              receive, and any files you attach.
            </li>
            <li>
              <b>Usage and billing</b> — credits, deposits, spend per request,
              and the model each request used.
            </li>
            <li>
              <b>Wallet addresses</b> you connect or send deposits from. These
              are public by nature.
            </li>
            <li>
              <b>IP addresses</b>, kept briefly and used only to rate-limit
              abuse.
            </li>
          </ul>
        </Block>

        <Block title="What we never see">
          <p>
            Card and bank details go directly to Stripe and Paystack and never
            touch our servers. We receive only a confirmation that a payment
            succeeded and the amount.
          </p>
        </Block>

        <Block title="Who we send your prompts to">
          <p>
            Answering you requires sending your conversation to the model
            provider you selected. Where a model runs inside a Trusted Execution
            Environment, that provider cannot read the contents either, and the
            attestation proving it is recorded on your receipt.
          </p>
        </Block>

        <Block title="What goes on-chain — and stays there">
          <p>
            Two distinct things reach the 0G network. The difference matters:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <b>Receipt fingerprints.</b> Every answer produces a receipt whose
              hashes are batched and anchored on the 0G chain. These are one-way
              fingerprints, not your text — they prove an answer was not altered
              afterwards, without publishing what it said.
            </li>
            <li>
              <b>Memory archives.</b> When AskZero builds long-term memory from a
              conversation, it uploads that archive — which{" "}
              <b>includes the conversation transcript</b> — to 0G decentralized
              storage.
            </li>
          </ul>
          <p className="mt-3">
            Both are <b>permanent and public</b>. Blockchain and decentralized
            storage are append-only by design: once written, no one can edit or
            remove them — not you, not us. Deleting your account removes our
            records and our pointer to an archive, but it cannot unpublish the
            archive itself.
          </p>
          <p className="mt-3">
            If a conversation is one you would not want permanently public, use{" "}
            <b>incognito mode</b>. Incognito conversations are never saved, never
            distilled into memory, and never uploaded.
          </p>
        </Block>

        <Block title="Deleting your account">
          <p>
            Deleting your account from Settings removes your profile, chats,
            messages, attachments, transactions, and stored memories from our
            database. What it cannot reach is the on-chain data described above,
            for the reason described above.
          </p>
        </Block>

        <Block title="Who else handles your data">
          <p>
            Supabase (database, authentication, file storage), Stripe and
            Paystack (payments), the model provider you select for each request,
            and the 0G network (receipts and memory archives). We do not sell
            your data, and we do not use your conversations to train models.
          </p>
        </Block>

        <Block title="Contact">
          <p>
            Questions, or a request about your data — email{" "}
            <a
              href="mailto:privacy@askzero.ai"
              className="font-medium text-accent hover:underline"
            >
              privacy@askzero.ai
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
