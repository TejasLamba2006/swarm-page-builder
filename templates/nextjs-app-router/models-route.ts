import { NextResponse } from "next/server";

export interface SwarmModel {
  id: string;
  name: string;
  provider: string;
  color: string;
  releaseDate: string;
}

interface ModelsDevEntry {
  id?: string;
  name?: string;
  tool_call?: boolean;
  release_date?: string;
}

interface ModelsDevProvider {
  id?: string;
  name?: string;
  models?: Record<string, ModelsDevEntry>;
}

const PROVIDER_META: {
  key: string;
  label: string;
  color: string;
  quota: number;
}[] = [
  { key: "anthropic", label: "Anthropic", color: "#d97757", quota: 3 },
  { key: "openai", label: "OpenAI", color: "#10a37f", quota: 3 },
  { key: "google", label: "Google", color: "#4285f4", quota: 3 },
  { key: "deepseek", label: "DeepSeek", color: "#4d6bfe", quota: 2 },
  { key: "xai", label: "xAI", color: "#f59e0b", quota: 2 },
  { key: "alibaba", label: "Qwen", color: "#6366f1", quota: 2 },
  { key: "moonshotai", label: "Moonshot", color: "#06b6d4", quota: 2 },
  { key: "zhipuai", label: "Zhipu", color: "#3b82f6", quota: 2 },
  { key: "mistral", label: "Mistral", color: "#f97316", quota: 2 },
  { key: "meta", label: "Meta", color: "#0ea5e9", quota: 2 },
  { key: "minimax", label: "MiniMax", color: "#ec4899", quota: 1 },
  { key: "cohere", label: "Cohere", color: "#14b8a6", quota: 1 },
  { key: "sakana", label: "Sakana", color: "#e11d48", quota: 1 },
];

const FALLBACK_MODELS: SwarmModel[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", provider: "Anthropic", color: "#d97757", releaseDate: "2026-09-22" },
  { id: "gpt-6.1-terra", name: "GPT-6.1 Terra", provider: "OpenAI", color: "#10a37f", releaseDate: "2026-10-26" },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", provider: "Google", color: "#4285f4", releaseDate: "2026-10-13" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "DeepSeek", color: "#4d6bfe", releaseDate: "2026-08-13" },
  { id: "grok-4.7", name: "Grok 4.7", provider: "xAI", color: "#f59e0b", releaseDate: "2026-09-21" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", provider: "Anthropic", color: "#e8896a", releaseDate: "2026-09-28" },
  { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", provider: "OpenAI", color: "#34c59a", releaseDate: "2026-09-29" },
  { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", provider: "Google", color: "#7aa7f7", releaseDate: "2026-09-02" },
  { id: "qwen3.8-max", name: "Qwen3.8 Max", provider: "Qwen", color: "#6366f1", releaseDate: "2026-08-03" },
  { id: "kimi-k3.1-pro", name: "Kimi K3.1 Pro", provider: "Moonshot", color: "#06b6d4", releaseDate: "2026-10-23" },
  { id: "glm-5.3", name: "GLM-5.3", provider: "Zhipu", color: "#3b82f6", releaseDate: "2026-08-14" },
  { id: "mistral-large-4", name: "Mistral Large 4", provider: "Mistral", color: "#f97316", releaseDate: "2026-10-06" },
  { id: "codestral-latest", name: "Codestral", provider: "Mistral", color: "#ff8205", releaseDate: "2026-05-01" },
  { id: "muse-wonder-1.0", name: "Muse Wonder", provider: "Meta", color: "#0ea5e9", releaseDate: "2026-10-12" },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "DeepSeek", color: "#6f86ff", releaseDate: "2026-10-17" },
  { id: "minimax-m2", name: "MiniMax M2", provider: "MiniMax", color: "#ec4899", releaseDate: "2026-08-01" },
  { id: "command-a", name: "Command A", provider: "Cohere", color: "#14b8a6", releaseDate: "2026-07-01" },
  { id: "fugu", name: "Sakana Fugu", provider: "Sakana", color: "#e11d48", releaseDate: "2026-06-15" },
];

// In-memory TTL cache avoids Next.js 2MB fetch cache limit on 7.9MB models.dev payload
let cachedPayload: { models: SwarmModel[]; source: string; ts: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  if (cachedPayload && Date.now() - cachedPayload.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { models: cachedPayload.models, source: cachedPayload.source },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } }
    );
  }

  try {
    const res = await fetch("https://models.dev/api.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) {
      return NextResponse.json({ models: FALLBACK_MODELS, source: "fallback" });
    }

    const data = (await res.json()) as Record<string, ModelsDevProvider>;
    const picked: SwarmModel[] = [];
    const seenIds = new Set<string>();

    for (const meta of PROVIDER_META) {
      const providerObj = data[meta.key];
      if (!providerObj?.models) continue;

      const candidates = Object.values(providerObj.models)
        .filter(
          (m): m is Required<Pick<ModelsDevEntry, "id" | "name">> & ModelsDevEntry =>
            Boolean(m?.id && m?.name && m.tool_call && m.release_date)
        )
        .sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""));

      let added = 0;
      for (const m of candidates) {
        if (added >= meta.quota) break;
        const normalizedId = m.id.toLowerCase();
        if (seenIds.has(normalizedId)) continue;
        seenIds.add(normalizedId);
        picked.push({
          id: m.id,
          name: m.name.length > 22 ? m.id : m.name,
          provider: meta.label,
          color: meta.color,
          releaseDate: m.release_date ?? "",
        });
        added++;
      }
    }

    if (picked.length < 18) {
      for (const fb of FALLBACK_MODELS) {
        if (picked.length >= 24) break;
        if (!seenIds.has(fb.id.toLowerCase())) {
          seenIds.add(fb.id.toLowerCase());
          picked.push(fb);
        }
      }
    }

    const finalModels = picked.slice(0, 24);
    cachedPayload = { models: finalModels, source: "models.dev", ts: Date.now() };

    return NextResponse.json(
      { models: finalModels, source: "models.dev" },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } }
    );
  } catch {
    return NextResponse.json({ models: FALLBACK_MODELS, source: "fallback" });
  }
}
