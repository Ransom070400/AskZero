"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

// Pricey models (≥ 50 credits per 1K output tokens, ~5¢) get a heads-up +
// badge when selected. Falls back to the model family when unpriced.
const PREMIUM_OUTPUT_PER_1K = 50;
const isPremiumModel = (m: ModelOption) =>
  m.pricePer1k
    ? m.pricePer1k.output >= PREMIUM_OUTPUT_PER_1K
    : /claude/i.test(m.model);

export interface ModelOption {
  provider: string;
  model: string;
  label: string;
  description?: string;
  supportsImages?: boolean;
  kind?: "chat" | "image";
  comingSoon?: boolean;
  // Retail credits per 1K tokens (from /api/models).
  pricePer1k?: { input: number; output: number };
  // 0G Router models: attestation level and when the router added the model
  // (unix seconds).
  trust?: "tee" | "tee-route" | "none";
  created?: number;
}

// A composer setting shown at the foot of the menu, Kimi-style
// ("Answer style  Default ›"), drilling into its options.
export interface PickerSetting {
  id: string;
  label: string;
  value: string;
  options: { id: string; label: string; description?: string }[];
  onChange: (id: string) => void;
}

// ── Vendors ────────────────────────────────────────────────────────────────
// Models are grouped by the company that makes them (not by how we serve
// them), so users can find "the Claude models" or "the GPT models" directly.
// How a model is served (TEE gateway vs on-chain broker) becomes a per-model
// tag instead of a top-level section.

type VendorKey =
  | "openai"
  | "anthropic"
  | "google"
  | "zhipu"
  | "deepseek"
  | "qwen"
  | "moonshot"
  | "minimax"
  | "baidu"
  | "tencent"
  | "xiaomi"
  | "stepfun"
  | "meituan"
  | "og"
  | "other";

interface Vendor {
  key: VendorKey;
  name: string;
  blurb: string;
  // Brand-tinted avatar (letter mark — no third-party logo assets).
  mark: string;
  avatar: string;
}

const VENDORS: Record<VendorKey, Vendor> = {
  openai: {
    key: "openai",
    name: "OpenAI",
    blurb: "GPT models",
    mark: "O",
    avatar: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
  },
  anthropic: {
    key: "anthropic",
    name: "Anthropic",
    blurb: "Claude models",
    mark: "A",
    avatar: "bg-[#D97757]/15 text-[#C15F3C]",
  },
  google: {
    key: "google",
    name: "Google",
    blurb: "Gemini models",
    mark: "G",
    avatar: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  zhipu: {
    key: "zhipu",
    name: "Z.ai",
    blurb: "GLM chat · Z-Image",
    mark: "Z",
    avatar: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  deepseek: {
    key: "deepseek",
    name: "DeepSeek",
    blurb: "DeepSeek models",
    mark: "D",
    avatar: "bg-[#4D6BFE]/15 text-[#4D6BFE]",
  },
  qwen: {
    key: "qwen",
    name: "Alibaba",
    blurb: "Qwen models",
    mark: "Q",
    avatar: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  moonshot: {
    key: "moonshot",
    name: "Moonshot AI",
    blurb: "Kimi models",
    mark: "K",
    avatar: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300",
  },
  minimax: {
    key: "minimax",
    name: "MiniMax",
    blurb: "MiniMax models",
    mark: "M",
    avatar: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
  baidu: {
    key: "baidu",
    name: "Baidu",
    blurb: "ERNIE models",
    mark: "B",
    avatar: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  },
  tencent: {
    key: "tencent",
    name: "Tencent",
    blurb: "Hunyuan models",
    mark: "T",
    avatar: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  },
  xiaomi: {
    key: "xiaomi",
    name: "Xiaomi",
    blurb: "MiMo models",
    mark: "X",
    avatar: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  },
  stepfun: {
    key: "stepfun",
    name: "StepFun",
    blurb: "Step models",
    mark: "S",
    avatar: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  meituan: {
    key: "meituan",
    name: "Meituan",
    blurb: "LongCat models",
    mark: "L",
    avatar: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  },
  og: {
    key: "og",
    name: "0G",
    blurb: "0G's own models",
    mark: "0",
    avatar: "bg-accent-muted text-accent",
  },
  other: {
    key: "other",
    name: "Other",
    blurb: "More models",
    mark: "?",
    avatar: "bg-elevated text-text-secondary",
  },
};

// Tie-break order for vendors with the same availability.
const VENDOR_ORDER: VendorKey[] = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "zhipu",
  "qwen",
  "moonshot",
  "minimax",
  "baidu",
  "tencent",
  "xiaomi",
  "stepfun",
  "meituan",
  "og",
  "other",
];

function vendorOf(m: ModelOption): VendorKey {
  const id = `${m.model} ${m.label}`.toLowerCase();
  if (/claude/.test(id)) return "anthropic";
  if (/gpt|openai|\bo[134]\b/.test(id)) return "openai";
  if (/glm|zai|z-image|zhipu/.test(id)) return "zhipu";
  if (/deepseek/.test(id)) return "deepseek";
  if (/qwen/.test(id)) return "qwen";
  if (/gemini|gemma/.test(id)) return "google";
  if (/kimi|moonshot/.test(id)) return "moonshot";
  if (/minimax/.test(id)) return "minimax";
  if (/ernie|qianfan/.test(id)) return "baidu";
  if (/hunyuan/.test(id)) return "tencent";
  if (/mimo/.test(id)) return "xiaomi";
  if (/\bstep[- ]?\d/.test(id)) return "stepfun";
  if (/longcat/.test(id)) return "meituan";
  if (/0gm/.test(id)) return "og";
  return "other";
}

// How the model is served — shown as a small tag on each model row.
function servedVia(m: ModelOption): string | null {
  const p = m.provider.toLowerCase();
  if (m.kind === "image" || p.startsWith("image")) return "Image";
  if (p.startsWith("integrate")) return "TEE-verified";
  if (p.startsWith("0x")) return "On-chain";
  // 0G Router: say exactly what is attested — nothing, for Claude/GPT/Gemini.
  if (m.trust === "tee") return "TEE-verified";
  if (m.trust === "tee-route") return "Verified route";
  if (m.trust === "none") return "Unverified";
  return null;
}

interface VendorGroup {
  vendor: Vendor;
  models: ModelOption[];
  available: number;
}

function groupByVendor(models: ModelOption[]): VendorGroup[] {
  const groups = new Map<VendorKey, VendorGroup>();
  for (const m of models) {
    const key = vendorOf(m);
    if (!groups.has(key)) {
      groups.set(key, { vendor: VENDORS[key], models: [], available: 0 });
    }
    const g = groups.get(key)!;
    g.models.push(m);
    if (!m.comingSoon) g.available++;
  }
  const list = Array.from(groups.values());
  for (const g of list) {
    // Usable models first, then most recently added to the router; our own
    // curated entries (no `created`) lead within their tier.
    g.models.sort(
      (a, b) =>
        Number(!!a.comingSoon) - Number(!!b.comingSoon) ||
        (b.created ?? Infinity) - (a.created ?? Infinity)
    );
  }
  // Vendors you can actually use float to the top.
  return list.sort(
    (a, b) =>
      Number(b.available > 0) - Number(a.available > 0) ||
      VENDOR_ORDER.indexOf(a.vendor.key) - VENDOR_ORDER.indexOf(b.vendor.key)
  );
}

// "Claude Opus 5 is premium — about 22× GLM 5.1's cost per reply."
function premiumNotice(m: ModelOption, base?: ModelOption): string {
  const name = m.label.split(" · ")[0];
  const reasons = /claude/i.test(m.model) ? ", and it reasons before replying" : "";
  const ratio =
    m.pricePer1k && base?.pricePer1k?.output
      ? Math.round(m.pricePer1k.output / base.pricePer1k.output)
      : null;
  return ratio && ratio > 1
    ? `${name} is premium — about ${ratio}× ${base!.label.split(" · ")[0]}'s cost per reply${reasons}.`
    : `${name} is a premium model — replies cost more than the default${reasons}.`;
}

function VendorAvatar({
  vendor,
  size = "md",
  image,
}: {
  vendor: Vendor;
  size?: "sm" | "md";
  image?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold",
        size === "sm"
          ? "h-6 w-6 rounded-full text-[11px]"
          : "h-8 w-8 rounded-lg text-[13px]",
        vendor.avatar
      )}
    >
      {image ? <ImageIcon className="h-3.5 w-3.5" /> : vendor.mark}
    </span>
  );
}

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "premium";
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
        tone === "premium"
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : "border border-border/70 text-text-tertiary"
      )}
    >
      {children}
    </span>
  );
}

export function ModelPicker({
  models,
  selected,
  disabled,
  onSelect,
  settings = [],
}: {
  models: ModelOption[];
  selected: { provider: string; model: string };
  disabled?: boolean;
  onSelect: (m: { provider: string; model: string }) => void;
  settings?: PickerSetting[];
}) {
  const active = models.find(
    (m) => m.provider === selected.provider && m.model === selected.model
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          aria-label="Choose model"
          className="press group inline-flex h-8 min-w-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-text-secondary transition-colors duration-fast ease-out hover:bg-surface hover:text-foreground disabled:opacity-50"
        >
          <span className="truncate">
            {active?.label.split(" · ")[0] ?? "Select model"}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-text-tertiary transition-colors duration-fast group-hover:text-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="top"
        className="max-h-[min(70vh,32rem)] w-80 overflow-y-auto overscroll-contain p-1"
      >
        {/* Mounted only while open, so the drill-down resets on every open. */}
        <PickerPanel
          models={models}
          selected={selected}
          onSelect={onSelect}
          settings={settings}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModelRow({
  m,
  models,
  selected,
  onSelect,
  showVendor,
}: {
  m: ModelOption;
  models: ModelOption[];
  selected: { provider: string; model: string };
  onSelect: (m: { provider: string; model: string }) => void;
  showVendor?: boolean;
}) {
  const isActive =
    m.provider === selected.provider && m.model === selected.model;
  // The app defaults to the first model returned by /api/models.
  const isDefault =
    !!models[0] &&
    m.provider === models[0].provider &&
    m.model === models[0].model;
  const isPremium = isPremiumModel(m);
  const soon = m.comingSoon;
  const via = servedVia(m);
  return (
    <DropdownMenuItem
      onClick={() => {
        if (soon) return;
        onSelect({ provider: m.provider, model: m.model });
        // Heads-up each time they switch to a premium model.
        if (isPremium && !isActive) {
          toast.info(premiumNotice(m, models[0]));
        }
      }}
      className={cn(
        "items-start gap-2.5 px-2 py-2.5",
        !soon && "hover-lift",
        isActive && "bg-accent-muted/50",
        soon && "pointer-events-none opacity-55"
      )}
    >
      {showVendor && (
        <VendorAvatar
          vendor={VENDORS[vendorOf(m)]}
          size="sm"
          image={m.kind === "image"}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span
          className={cn(
            "flex w-full flex-wrap items-center gap-1.5 text-left text-[13px] text-foreground",
            isActive ? "font-semibold" : "font-medium"
          )}
        >
          <span className="truncate">{m.label.split(" · ")[0]}</span>
          {isDefault && <Tag>Default</Tag>}
          {isPremium && !soon && <Tag tone="premium">Premium</Tag>}
          {soon ? <Tag>Soon</Tag> : via && <Tag>{via}</Tag>}
        </span>
        {m.description && (
          <span className="line-clamp-2 text-left text-[11px] font-normal leading-snug text-text-tertiary">
            {m.description}
          </span>
        )}
      </div>
      {isActive && <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" />}
    </DropdownMenuItem>
  );
}

function PickerPanel({
  models,
  selected,
  onSelect,
  settings,
}: {
  models: ModelOption[];
  selected: { provider: string; model: string };
  onSelect: (m: { provider: string; model: string }) => void;
  settings: PickerSetting[];
}) {
  const groups = groupByVendor(models);
  const isSelected = (m: ModelOption) =>
    m.provider === selected.provider && m.model === selected.model;
  const rowProps = { models, selected, onSelect };

  const [openVendor, setOpenVendor] = useState<VendorKey | null>(null);
  const [query, setQuery] = useState("");
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const group = groups.find((g) => g.vendor.key === openVendor);
  const setting = settings.find((st) => st.id === openSetting);

  const backRow = (onBack: () => void, children: React.ReactNode) => (
    <>
      <button
        type="button"
        onClick={onBack}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors duration-fast hover:bg-elevated"
      >
        <ChevronLeft className="h-4 w-4 text-text-tertiary" />
        {children}
      </button>
      <div className="-mx-1 my-1 h-px bg-border/60" />
    </>
  );

  // ── Level 2: one setting's options ──
  if (setting) {
    return (
      <div>
        {backRow(
          () => setOpenSetting(null),
          <span className="text-[13px] font-semibold text-foreground">
            {setting.label}
          </span>
        )}
        {setting.options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              setting.onChange(o.id);
              setOpenSetting(null);
            }}
            className={cn(
              "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-fast hover:bg-elevated",
              o.id === setting.value && "bg-accent-muted/50"
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-medium text-foreground">
                {o.label}
              </span>
              {o.description && (
                <span className="text-[11px] leading-snug text-text-tertiary">
                  {o.description}
                </span>
              )}
            </div>
            {o.id === setting.value && (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            )}
          </button>
        ))}
      </div>
    );
  }

  // ── Level 2: one company's models ──
  if (group) {
    return (
      <div>
        {backRow(
          () => setOpenVendor(null),
          <>
            <VendorAvatar vendor={group.vendor} size="sm" />
            <span className="text-[13px] font-semibold text-foreground">
              {group.vendor.name}
            </span>
            <span className="ml-auto text-[11px] text-text-tertiary">
              All companies
            </span>
          </>
        )}
        {group.models.map((m) => (
          <ModelRow key={`${m.provider}|${m.model}`} m={m} {...rowProps} />
        ))}
      </div>
    );
  }

  // Search across every company: "opus", "gemini", "deepseek r1"…
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = terms.length
    ? groups.flatMap((g) =>
        g.models.filter((m) => {
          const hay = `${m.label} ${m.model} ${g.vendor.name}`.toLowerCase();
          return terms.every((t) => hay.includes(t));
        })
      )
    : null;

  // ── Level 1: search + companies ──
  return (
    <div>
      <div className="sticky -top-1 z-10 -mx-1 -mt-1 bg-popover px-2 pb-1 pt-2">
        <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-elevated/60 px-2.5 py-1.5 focus-within:border-border-strong">
          <Search className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${models.length} models`}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-text-tertiary"
          />
        </label>
      </div>

      {matches ? (
        matches.length ? (
          matches.map((m) => (
            <ModelRow
              key={`${m.provider}|${m.model}`}
              m={m}
              showVendor
              {...rowProps}
            />
          ))
        ) : (
          <p className="px-2.5 py-6 text-center text-[12px] text-text-tertiary">
            No models match &ldquo;{query}&rdquo;
          </p>
        )
      ) : (
        <>
          <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            Choose a company
          </p>
          {groups.map(({ vendor, models: vm, available }) => {
            const current = vm.find(isSelected);
            const onlyImage = vm.every((m) => m.kind === "image");
            return (
              <button
                key={vendor.key}
                type="button"
                onClick={() => setOpenVendor(vendor.key)}
                className={cn(
                  "hover-lift flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-fast hover:bg-elevated",
                  current && "bg-accent-muted/50"
                )}
              >
                <VendorAvatar vendor={vendor} image={onlyImage} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                    {vendor.name}
                    {available === 0 && <Tag>Soon</Tag>}
                  </span>
                  <span className="truncate text-[11px] text-text-tertiary">
                    {current
                      ? `Using ${current.label.split(" · ")[0]}`
                      : available > 0
                        ? `${vendor.blurb} · ${available} available`
                        : `${vendor.blurb} · coming soon`}
                  </span>
                </div>
                {current && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                )}
                <span className="shrink-0 text-[11px] tabular-nums text-text-tertiary">
                  {vm.length}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
              </button>
            );
          })}

          {settings.length > 0 && (
            <>
              <div className="-mx-1 my-1 h-px bg-border/60" />
              {settings.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setOpenSetting(st.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-fast hover:bg-elevated"
                >
                  <span className="text-[13px] font-medium text-foreground">
                    {st.label}
                  </span>
                  <span className="ml-auto text-[12px] text-text-tertiary">
                    {st.options.find((o) => o.id === st.value)?.label}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                </button>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
