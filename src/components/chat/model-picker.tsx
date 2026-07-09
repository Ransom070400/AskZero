"use client";

import { Check, ChevronDown, ImageIcon, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

type GroupKey = "integrate" | "image" | "og";

interface ProviderGroup {
  key: GroupKey;
  label: string;
  hint: string;
  models: ModelOption[];
}

function providerKey(provider: string): GroupKey {
  const p = provider.toLowerCase();
  if (p.startsWith("image")) return "image";
  if (p.startsWith("integrate")) return "integrate";
  return "og";
}

const GROUP_ORDER: GroupKey[] = ["integrate", "image", "og"];

function groupModels(models: ModelOption[]): ProviderGroup[] {
  const groups = new Map<GroupKey, ProviderGroup>();
  for (const m of models) {
    const key = providerKey(m.provider);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label:
          key === "integrate"
            ? "Integrate Network"
            : key === "image"
              ? "Image generation"
              : "0G Compute",
        hint:
          key === "integrate"
            ? "Private & verified — runs in a secure enclave"
            : key === "image"
              ? "Text-to-image · your prompt becomes a picture"
              : "Verified inference · runs on 0G",
        models: [],
      });
    }
    groups.get(key)!.models.push(m);
  }
  return Array.from(groups.values()).sort(
    (a, b) => GROUP_ORDER.indexOf(a.key) - GROUP_ORDER.indexOf(b.key)
  );
}

function avatarLetter(label: string): string {
  return (label.match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase();
}

function avatarClass(key: GroupKey, active: boolean): string {
  if (active) return "bg-accent text-white";
  if (key === "integrate") return "bg-accent-muted text-accent";
  if (key === "image") return "bg-purple-500/15 text-purple-500";
  return "bg-elevated text-text-secondary";
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
  const groups = groupModels(models);
  const activeKey = active ? providerKey(active.provider) : "og";
  // The app defaults to the first model returned by /api/models.
  const defaultKey = models[0]
    ? `${models[0].provider}|${models[0].model}`
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className="press group inline-flex items-center gap-2 rounded-full border border-border/70 bg-elevated/60 py-1 pl-1 pr-3 text-[12px] font-semibold text-foreground transition-[border-color,background-color] duration-fast ease-out hover:border-border-strong disabled:opacity-50"
        >
          {active ? (
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                avatarClass(activeKey, false)
              )}
            >
              {activeKey === "image" ? (
                <ImageIcon className="h-3 w-3" />
              ) : (
                avatarLetter(active.label)
              )}
            </span>
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
        className="max-h-[min(70vh,32rem)] w-80 overflow-y-auto p-1"
      >
        {groups.map((group, gi) => (
          <div key={group.key}>
            {gi > 0 && <DropdownMenuSeparator />}
            <div className="px-2.5 pb-1 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                {group.label}
              </p>
              <p className="mt-0.5 text-[11px] text-text-tertiary">
                {group.hint}
              </p>
            </div>
            {group.models.map((m) => {
              const isActive =
                m.provider === selected.provider && m.model === selected.model;
              const isDefault = `${m.provider}|${m.model}` === defaultKey;
              const isPremium = isPremiumModel(m.model);
              const soon = m.comingSoon;
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
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold",
                      avatarClass(group.key, isActive)
                    )}
                  >
                    {group.key === "image" ? (
                      <ImageIcon className="h-3.5 w-3.5" />
                    ) : (
                      avatarLetter(m.label)
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    <span
                      className={cn(
                        "flex w-full items-center gap-1.5 text-left text-[13px] text-foreground",
                        isActive ? "font-semibold" : "font-medium"
                      )}
                    >
                      <span className="truncate">{m.label}</span>
                      {isDefault && (
                        <span className="shrink-0 rounded-full border border-border/70 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-text-tertiary">
                          Default
                        </span>
                      )}
                      {isPremium && !soon && (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          Premium
                        </span>
                      )}
                      {soon && (
                        <span className="shrink-0 rounded-full border border-border/70 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-text-tertiary">
                          Soon
                        </span>
                      )}
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
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
