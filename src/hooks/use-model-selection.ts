"use client";

import { useCallback, useEffect, useState } from "react";
import type { ModelOption } from "@/components/chat/model-picker";

const STORAGE_KEY = "askzero:model";

type Selection = { provider: string; model: string };

// The model list plus the user's pick, remembered across chats and shared by
// the home composer and the chat page (so a choice made on /chat carries into
// the conversation it starts). Falls back to the first model /api/models
// returns — the app default — when nothing valid is saved.
export function useModelSelection() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState<Selection | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models: ModelOption[] }) => {
        setModels(data.models);
        let saved: Selection | null = null;
        try {
          saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
        } catch {
          // storage blocked or corrupt — use the default
        }
        const usable = data.models.find(
          (m) =>
            !m.comingSoon &&
            m.provider === saved?.provider &&
            m.model === saved?.model
        );
        const pick = usable ?? data.models[0];
        if (pick) setSelected({ provider: pick.provider, model: pick.model });
      })
      .catch(() => {});
  }, []);

  const select = useCallback((next: Selection) => {
    setSelected(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // non-fatal: the choice just won't persist
    }
  }, []);

  const active = models.find(
    (m) => m.provider === selected?.provider && m.model === selected?.model
  );

  return { models, selected, select, active };
}
