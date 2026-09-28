"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

// Frontier-but-pricey models get a heads-up + badge when selected.
const isPremiumModel = (model: string) => /claude/i.test(model);

export interface ModelOption {
  provider: string;
  model: string;
  label: string;
  description?: string;
  supportsImages?: boolean;
  kind?: "chat" | "image";
  comingSoon?: boolean;
}

// ── Vendors ────────────────────────────────────────────────────────────────
// Models are grouped by the company that makes them (not by how we serve
// them), so users can find "the Claude models" or "the GPT models" directly.
// How a model is served (TEE gateway vs on-chain broker) becomes a per-model
// tag instead of a top-level section.

type VendorKey =
  | "openai"
  | "anthropic"
  | "zhipu"
  | "deepseek"
  | "qwen"
  | "minimax"
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
  minimax: {
    key: "minimax",
    name: "MiniMax",
    blurb: "MiniMax models",
    mark: "M",
    avatar: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
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
  "zhipu",
  "deepseek",
  "qwen",
  "minimax",
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
  if (/minimax/.test(id)) return "minimax";
  if (/0gm/.test(id)) return "og";
  return "other";
}

// How the model is served — shown as a small tag on each model row.
function servedVia(m: ModelOption): string | null {
  const p = m.provider.toLowerCase();
  if (m.kind === "image" || p.startsWith("image")) return "Image";
  if (p.startsWith("integrate")) return "TEE-verified";
  if (p.startsWith("0x")) return "On-chain";
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
    // Usable models first; keep API order otherwise.
    g.models.sort((a, b) => Number(!!a.comingSoon) - Number(!!b.comingSoon));
  }
  // Vendors you can actually use float to the top.
  return list.sort(
    (a, b) =>
      Number(b.available > 0) - Number(a.available > 0) ||
      VENDOR_ORDER.indexOf(a.vendor.key) - VENDOR_ORDER.indexOf(b.vendor.key)
  );
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
}: {
  models: ModelOption[];
  selected: { provider: string; model: string };
  disabled?: boolean;
  onSelect: (m: { provider: string; model: string }) => void;
}) {
  const active = models.find(
    (m) => m.provider === selected.provider && m.model === selected.model
  );
  const activeVendor = active ? VENDORS[vendorOf(active)] : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className="press group inline-flex items-center gap-2 rounded-full border border-border/70 bg-elevated/60 py-1 pl-1 pr-3 text-[12px] font-semibold text-foreground transition-[border-color,background-color] duration-fast ease-out hover:border-border-strong disabled:opacity-50"
        >
          {active && activeVendor ? (
            <VendorAvatar
              vendor={activeVendor}
              size="sm"
              image={active.kind === "image"}
            />
          ) : (
            <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-muted text-accent">
              <Sparkles className="h-3 w-3" />
            </span>
          )}
          <span className="leading-none">
            {active?.label ?? "Select model"}
          </span>
          <ChevronDown className="h-3 w-3 text-text-tertiary group-hover:text-foreground transition-colors duration-fast" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        className="max-h-[min(70vh,32rem)] w-80 overflow-y-auto overscroll-contain p-1"
      >
        {/* Mounted only while open, so the drill-down resets on every open. */}
        <PickerPanel models={models} selected={selected} onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PickerPanel({
  models,
  selected,
  onSelect,
}: {
  models: ModelOption[];
  selected: { provider: string; model: string };
  onSelect: (m: { provider: string; model: string }) => void;
}) {
  const groups = groupByVendor(models);
  const isSelected = (m: ModelOption) =>
    m.provider === selected.provider && m.model === selected.model;
  // The app defaults to the first model returned by /api/models.
  const defaultKey = models[0]
    ? `${models[0].provider}|${models[0].model}`
    : null;

  const [openVendor, setOpenVendor] = useState<VendorKey | null>(null);
  const group = groups.find((g) => g.vendor.key === openVendor);

  // ── Level 2: one company's models ──
  if (group) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpenVendor(null)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors duration-fast hover:bg-elevated"
        >
          <ChevronLeft className="h-4 w-4 text-text-tertiary" />
          <VendorAvatar vendor={group.vendor} size="sm" />
          <span className="text-[13px] font-semibold text-foreground">
            {group.vendor.name}
          </span>
          <span className="ml-auto text-[11px] text-text-tertiary">
            All companies
          </span>
        </button>
        <div className="-mx-1 my-1 h-px bg-border/60" />

        {group.models.map((m) => {
          const isActive = isSelected(m);
          const isDefault = `${m.provider}|${m.model}` === defaultKey;
          const isPremium = isPremiumModel(m.model);
          const soon = m.comingSoon;
          const via = servedVia(m);
          return (
            <DropdownMenuItem
              key={`${m.provider}|${m.model}`}
              onClick={() => {
                if (soon) return;
                onSelect({ provider: m.provider, model: m.model });
                // Heads-up each time they switch to a premium model.
                if (isPremium && !isActive) {
                  toast.info(
                    `${m.label.split(" · ")[0]} — the most capable model here, but premium: roughly 15× GLM's per-token cost, and it reasons before replying.`
                  );
                }
              }}
              className={cn(
                "items-start gap-2.5 px-2 py-2.5",
                !soon && "hover-lift",
                isActive && "bg-accent-muted/50",
                soon && "pointer-events-none opacity-55"
              )}
            >
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
              {isActive && (
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" />
              )}
            </DropdownMenuItem>
          );
        })}
      </div>
    );
  }

  // ── Level 1: companies ──
  return (
    <div>
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
            {current && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
            <span className="shrink-0 text-[11px] tabular-nums text-text-tertiary">
              {vm.length}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          </button>
        );
      })}
    </div>
  );
}
