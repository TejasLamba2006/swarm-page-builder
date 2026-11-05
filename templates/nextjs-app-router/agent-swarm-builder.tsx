"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
// Delete this import and the /api/models fetch below if you skip models-route.ts.
import type { SwarmModel } from "@/app/api/models/route";

// Engine: public/swarm-engine.js (copy of assets/swarm-engine.js)
const STORAGE_KEY = "portfolio-built-paths-v1";

const DEFAULT_ROSTER = [
  ["Claude Opus 5.5", "#d97757"], ["GPT-6.1 Terra", "#10a37f"], ["Gemini 4 Argon", "#4285f4"],
  ["DeepSeek V4 Pro", "#4d6bfe"], ["Grok 4.7", "#f59e0b"], ["Claude Sonnet 5.5", "#e8896a"],
  ["GPT-6.1 Sol", "#34c59a"], ["Gemini 3.8 Flash", "#7aa7f7"], ["Qwen3.8 Max", "#615ced"],
  ["Kimi K3.1 Pro", "#16a9ff"], ["GLM-5.3", "#3b82f6"], ["Mistral Large 4", "#fa520f"],
  ["Codestral", "#ff8205"], ["Muse Wonder", "#ec4899"], ["DeepSeek V4 Flash", "#6f86ff"],
  ["MiniMax M2", "#f23f5d"], ["Command A", "#39594d"], ["Sakana Fugu", "#e11d48"],
].map(([name, color]) => ({ name, color }));

interface Engine {
  start(): void;
  restart(): void;
  abort(): void;
}
type W = Window & { __swarmRebuild?: Engine; __swarmModels?: { name: string; color: string }[] };

const wasBuilt = (p: string) => {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(v) && v.includes(p);
  } catch {
    return false;
  }
};

let loading: Promise<Engine | null> | null = null;
function loadEngine(): Promise<Engine | null> {
  const w = window as W;
  if (w.__swarmRebuild) return Promise.resolve(w.__swarmRebuild);
  loading ??= new Promise((resolve) => {
    // roster: defaults now, upgraded by /api/models if it answers in time
    w.__swarmModels ??= DEFAULT_ROSTER;
    fetch("/api/models")
      .then((r) => r.json())
      .then((d: { models?: SwarmModel[] }) => {
        const api = (d.models ?? []).map(({ name, color }) => ({ name, color }));
        const have = new Set(api.map((m) => m.name));
        w.__swarmModels = [...api, ...DEFAULT_ROSTER.filter((m) => !have.has(m.name))];
      })
      .catch(() => {});
    const s = document.createElement("script");
    s.src = "/swarm-engine.js";
    s.onload = () => resolve(w.__swarmRebuild ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loading;
}

export default function AgentSwarmBuilder() {
  const pathname = usePathname();
  const [building, setBuilding] = useState(false);
  const [canReplay, setCanReplay] = useState(false);

  // engine events drive the pill
  useEffect(() => {
    const on = () => setBuilding(true);
    const off = () => {
      setBuilding(false);
      setCanReplay(true);
    };
    window.addEventListener("portfolio:swarm-start", on);
    window.addEventListener("portfolio:swarm-end", off);
    return () => {
      window.removeEventListener("portfolio:swarm-start", on);
      window.removeEventListener("portfolio:swarm-end", off);
    };
  }, []);

  // per-route: abort any running build, start fresh if this path is unbuilt
  const first = useRef(true);
  useEffect(() => {
    const w = window as W;
    const root = document.documentElement;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fresh = !reduced && !wasBuilt(pathname);
    let dead = false;
    w.__swarmRebuild?.abort();
    if (!fresh) {
      root.removeAttribute("data-swarm-init");
      root.removeAttribute("data-swarm-building");
      return;
    }
    // initial load: head script already set the cover; client nav: set it now
    if (!first.current) root.setAttribute("data-swarm-init", "true");
    first.current = false;
    // 60ms lets the new route paint under the cover; engine waits on fonts itself
    const t = setTimeout(async () => {
      const e = await loadEngine();
      if (dead || !e) return root.removeAttribute("data-swarm-init");
      e.start();
    }, 60);
    return () => {
      dead = true;
      clearTimeout(t);
      (window as W).__swarmRebuild?.abort();
    };
  }, [pathname]);

  useEffect(() => {
    const replay = async () => {
      const e = await loadEngine();
      e?.restart();
    };
    window.addEventListener("portfolio:replay-build", replay);
    return () => window.removeEventListener("portfolio:replay-build", replay);
  }, []);

  if (building || !canReplay) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("portfolio:replay-build"))}
      title="Replay the page build"
      style={{
        position: "fixed", bottom: 16, left: 16, zIndex: 40, padding: "6px 10px",
        borderRadius: 999, border: "1px dashed currentColor", opacity: 0.7,
        background: "transparent", color: "inherit", font: "11px ui-monospace, monospace", cursor: "pointer",
      }}
    >
      replay build
    </button>
  );
}
