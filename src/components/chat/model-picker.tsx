"use client";

import { Check, ChevronDown, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ModelOption {
  provider: string;
  model: string;
  label: string;
  description?: string;
}

interface ProviderGroup {
  key: "integrate" | "og";
  label: string;
  hint: string;
  models: ModelOption[];
}

function providerKey(provider: string): "integrate" | "og" {
  return provider.toLowerCase().startsWith("integrate") ? "integrate" : "og";
}

function groupModels(models: ModelOption[]): ProviderGroup[] {
  const groups = new Map<ProviderGroup["key"], ProviderGroup>();
  for (const m of models) {
    const key = providerKey(m.provider);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: key === "integrate" ? "Integrate Network" : "0G Compute",
        hint:
          key === "integrate"
            ? "Mainnet · TEE-verified inference"
            : "Decentralized providers",
        models: [],
      });
    }
    groups.get(key)!.models.push(m);
  }
  // Stable, opinionated ordering: Integrate first (it's the curated tier).
  return Array.from(groups.values()).sort((a, b) =>
    a.key === "integrate" ? -1 : b.key === "integrate" ? 1 : 0
  );
}

function avatarLetter(label: string): string {
  return (label.match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase();
}

function avatarClass(key: ProviderGroup["key"], active: boolean): string {
  if (active) return "bg-accent text-white";
  return key === "integrate"
    ? "bg-accent-muted text-accent"
    : "bg-elevated text-text-secondary";
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
              {avatarLetter(active.label)}
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

      <DropdownMenuContent align="start" className="w-80 p-1">
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
              return (
                <DropdownMenuItem
                  key={`${m.provider}|${m.model}`}
                  onClick={() =>
                    onSelect({ provider: m.provider, model: m.model })
                  }
                  className={cn(
                    "items-start gap-2.5 px-2 py-2.5",
                    isActive && "bg-accent-muted/50"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold",
                      avatarClass(group.key, isActive)
                    )}
                  >
                    {avatarLetter(m.label)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    <span
                      className={cn(
                        "w-full truncate text-left text-[13px] text-foreground",
                        isActive ? "font-semibold" : "font-medium"
                      )}
                    >
                      {m.label}
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
