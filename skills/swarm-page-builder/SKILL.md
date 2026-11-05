---
name: swarm-page-builder
description: Use when the user wants multiplayer AI or Figma-style cursors to build or assemble their website live in front of visitors, a page-load "agents are building this page" animation, or a swarm cursor intro for a portfolio, landing page or docs site. Installs a zero-dependency engine that snapshots the live DOM and replays it as rects, typed text, pen lines and ruler guides drawn by named cursors, then dissolves into the real page. Works with Next.js (App Router or Pages), React/Vite, Astro and plain HTML.
---

# swarm-page-builder

Adds a first-visit animation: named cursors rebuild the page on a canvas, then the canvas dissolves into the real page. The engine is one file (`assets/swarm-engine.js`, no dependencies). It runs once per route per browser session (tracked in `sessionStorage` under `portfolio-built-paths-v1`) and is skipped for `prefers-reduced-motion`.

## Steps

1. **Detect the framework.** Check `package.json` and the file layout:
   - `next` plus `src/app/` or `app/` : Next.js App Router
   - `next` plus `pages/` : Next.js Pages
   - `astro` : Astro
   - `vite` / `react` without `next` : React/Vite
   - none of those, only `.html` files : plain HTML

2. **Copy the engine.** Copy `assets/swarm-engine.js` from this skill to the site's static folder as `swarm-engine.js` (`public/` for Next, Vite and Astro; the web root for plain HTML). It must be served at `/swarm-engine.js`.

3. **Add the zero-flash cover.** Without it, visitors see the real page for a moment before the build starts.
   - CSS (global stylesheet, or `<style>` in `<head>`):
     ```css
     html[data-swarm-init="true"]::before {
       content: ""; position: fixed; inset: 0; z-index: 2147483640;
       background: <the site's real page background>;
     }
     ```
     Use the site's actual background (a CSS variable such as `hsl(var(--background))` if it has one). If it supports dark mode, use the same variable so the cover matches.
   - `<head>` script, as early as possible (in Next, `<script dangerouslySetInnerHTML>` inside `<head>` in `layout.tsx`; in Astro/HTML, an inline `<script>`). Copy it from `templates/vanilla-html/snippet.html`. It sets `data-swarm-init` and `data-swarm-building` on `<html>` when the current path has not been built this session and reduced motion is off.
   - In Next, add `suppressHydrationWarning` to `<html>` because the script changes its attributes before hydration.

4. **Mount the controller.**
   - Next.js App Router: copy `templates/nextjs-app-router/agent-swarm-builder.tsx` to `src/components/` and render `<AgentSwarmBuilder />` once in `layout.tsx`. It restarts per route on client navigation and handles the replay button. Adjust the `@/app/api/models/route` import path to match the project, or delete it if skipping step 5.
   - Next.js Pages: do the same in `_app.tsx`, swapping `usePathname` for `useRouter().asPath` (strip query and hash).
   - React/Vite: same component, using `location.pathname` from the router in place of `usePathname`, and remove the `next/navigation` import.
   - Astro / plain HTML: paste the last `<script>` block of `templates/vanilla-html/snippet.html` before `</body>`. It loads the engine and calls `window.__swarmRebuild.start()`.

5. **Optional: live LLM roster.** Copy `templates/nextjs-app-router/models-route.ts` to `src/app/api/models/route.ts`. It reads `https://models.dev/api.json`, keeps recent tool-calling models per provider with a brand color, caches for 24 hours in memory and falls back to a static list. The component sets `window.__swarmModels` from it. For non-Next sites, either skip this or fetch the same JSON from your own endpoint and assign `window.__swarmModels = [{ name, color }, ...]` before calling `start()`.

6. **Optional: smooth-scroll libraries (Lenis etc.).** The engine auto-scrolls the page while it builds, pauses if the visitor scrolls up and resumes when they scroll back down. If the site uses Lenis, stop it on `portfolio:swarm-start` and start it on `portfolio:swarm-end`:
   ```js
   window.addEventListener("portfolio:swarm-start", () => lenis.stop());
   window.addEventListener("portfolio:swarm-end", () => lenis.start());
   ```

7. **Verify.** Run the dev server, open the page in a fresh tab (or clear `sessionStorage`), and confirm: no flash of the real page, cursors build the page, scrolling up pauses, the page reveals at the end. Then reload and confirm the build does not replay. Call `window.__swarmRebuild.restart()` in the console to replay.

## Events and API

- Events on `window`: `portfolio:swarm-start`, `portfolio:swarm-end`, and `portfolio:replay-build` (listened to by the template component).
- `window.__swarmRebuild`: `start()`, `restart()`, `abort()`, `stop()`, `toggle()`.
- `window.__swarmModels`: `{ name: string, color: string }[]`, read when cursors are created. Set it before `start()`.

## Notes

- Do not wrap the engine in a bundler. It is a classic script that attaches `window.__swarmRebuild`.
- Pages with very large DOMs are capped (4000 items, 40000px height).
- Credits: Joel Califa (`califa/swarm-site`) for the original Swarm motion design, `DhvanilPatel/swarm-cursors` for the DOM-to-blueprint engine this is adapted from.
