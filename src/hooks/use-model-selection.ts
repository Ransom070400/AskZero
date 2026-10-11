"use client";

import { useCallback, useEffect, useState } from "react";
import type { ModelOption } from "@/components/chat/model-picker";

const STORAGE_KEY = "askzero:model";

type Selection = { provider: string; model: string };

// The model list plus the user's pick, remembered across chats and shared by
// the home composer and the chat page (so a choice made on /chat carries into
// the conversation it starts). Falls back to the first model /api/models
// returns — the app default — when nothing valid is saved.
const MODELS_CACHE_KEY = "askzero:models";

// One fetch per page session, shared by every caller (the home composer and
// the chat page both mount this hook, back to back, when a chat starts).
let modelsPromise: Promise<ModelOption[]> | null = null;
function fetchModels(): Promise<ModelOption[]> {
  modelsPromise ??= fetch("/api/models")
    .then((r) => r.json())
    .then((data: { models: ModelOption[] }) => {
      try {
        localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(data.models));
      } catch {
        // storage blocked — the next visit just waits for the fetch
      }
      return data.models;
    })
    .catch((err) => {
      modelsPromise = null; // let the next mount retry
      throw err;
    });
  return modelsPromise;
}

function readJSON<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function pickFrom(models: ModelOption[], saved: Selection | null): Selection | null {
  const usable = models.find(
    (m) => !m.comingSoon && m.provider === saved?.provider && m.model === saved?.model
  );
  const pick = usable ?? models.find((m) => !m.comingSoon) ?? models[0];
  return pick ? { provider: pick.provider, model: pick.model } : null;
}

export function useModelSelection() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState<Selection | null>(null);

  useEffect(() => {
    // Stale-while-revalidate: the last list and the saved pick are ready
    // immediately, so a chat started from the home screen sends at once
    // instead of waiting for /api/models. The fresh list then replaces them.
    const saved = readJSON<Selection>(STORAGE_KEY);
    const cached = readJSON<ModelOption[]>(MODELS_CACHE_KEY);
    if (cached?.length) {
      setModels(cached);
      setSelected(pickFrom(cached, saved));
    } else if (saved) {
      setSelected(saved);
    }

    let cancelled = false;
    fetchModels()
      .then((fresh) => {
        if (cancelled) return;
        setModels(fresh);
        setSelected((current) => pickFrom(fresh, current ?? saved));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
