# swarm-page-builder

A Claude Code skill and a standalone script that make your website build itself in front of the visitor. Named cursors show up, draw the boxes, type the text, pull ruler guides and then the canvas dissolves into your real page. Takes about 15 to 20 seconds on a typical page and runs once per route per browser session.

The engine is a single file with no dependencies: `assets/swarm-engine.js`.

## What it does

1. Walks your live DOM and snapshots rects, text blocks and their line breaks, images and video, borders and repeated components into a blueprint.
2. Paints an opaque canvas inside a Shadow DOM so your page CSS can't leak in.
3. Drives a flock of multiplayer-style cursors with generator scripts. Each one draws crosshair rects, types text with an I-beam caret, draws pen-tool lines, drags Figma-style ruler guides that snap, and alt-drags duplicates for repeated components.
4. Plays Web Audio: mechanical key clicks and notes from an E major pentatonic scale.
5. Auto-scrolls down as the build frontier moves. If the visitor scrolls up it pauses, and it resumes when they scroll back down to the frontier.
6. Dissolves into the real page when done.

## Install

As a Claude Code skill:

```sh
npx skills add TejasLamba2006/swarm-page-builder
```

Or clone it where Claude Code looks for skills:

```sh
git clone https://github.com/TejasLamba2006/swarm-page-builder ~/.claude/skills/swarm-page-builder
```

Then ask your agent something like "add the swarm page builder to this site". It detects your framework, copies the engine, adds the first-paint cover, and mounts the controller. `SKILL.md` has the exact steps.

Without an agent, copy the files yourself:

| Stack | Files |
| --- | --- |
| Next.js App Router | `assets/swarm-engine.js` to `public/`, `templates/nextjs-app-router/agent-swarm-builder.tsx` to your components, render it once in `layout.tsx`. Optional: `models-route.ts` to `app/api/models/route.ts`. |
| Plain HTML, Astro, Vite | `assets/swarm-engine.js` to your static folder, paste `templates/vanilla-html/snippet.html` into `<head>` and before `</body>`. |
| Next.js Pages, React/Vite | Use the App Router component and swap `usePathname` for your router's current path. |

## First-paint cover

The engine can only measure your page once it has rendered, so without help the visitor sees the real page, then a blank canvas, then the build. To avoid that, a tiny inline script in `<head>` sets `data-swarm-init="true"` on `<html>` when this route hasn't been built yet. A CSS rule then paints a fixed full-screen layer in your background color:

```css
html[data-swarm-init="true"]::before {
  content: ""; position: fixed; inset: 0; z-index: 2147483640;
  background: hsl(var(--background));
}
```

The real DOM stays at full opacity underneath so the snapshot can measure it. The engine removes the attribute once its own opaque canvas is up. Set the background to your actual page color.

## Configuration

There is no config object. These are the hooks:

- `window.__swarmModels = [{ name, color }, ...]`: names and colors for the cursors. Set before `start()`. Without it you get people names (Ada, Linus, Grace...) and Figma-ish colors.
- `window.__swarmRebuild.start() / restart() / abort() / stop() / toggle()`: control the run.
- Events on `window`: `portfolio:swarm-start`, `portfolio:swarm-end`. The Next template also listens for `portfolio:replay-build`.
- `sessionStorage` key `portfolio-built-paths-v1`: JSON array of pathnames already built this session. Clear it to see the build again.
- `prefers-reduced-motion: reduce` skips the build entirely.
- Smooth-scroll libraries: with Lenis, call `lenis.stop()` on `portfolio:swarm-start` and `lenis.start()` on `portfolio:swarm-end`.

Limits baked into the engine: 4000 snapshot items, 40000px of page height, 8 to 48 cursors depending on page size.

## Live model roster

`templates/nextjs-app-router/models-route.ts` is an optional route handler. It fetches `https://models.dev/api.json`, keeps the newest tool-calling models for each major provider, attaches a brand color, and returns up to 24. The result is cached in memory for 24 hours (the payload is a few MB, over Next's fetch cache limit). If models.dev is down it returns a static list. The component merges the response with a built-in default list, so cursors are named after real models even if the request fails.

## Credits

- Joel Califa ([@califa](https://github.com/califa), `califa/swarm-site`) designed the original Swarm motion: the cursors, the rect-and-type build, the feel of it. Go look at his site.
- [`DhvanilPatel/swarm-cursors`](https://github.com/DhvanilPatel/swarm-cursors) is the DOM-to-blueprint snapshot engine that `assets/swarm-engine.js` is adapted from.

What this repo adds on top:

- A Claude Code skill and `skills.sh` layout that wires the engine into a site for you.
- Templates for Next.js, React, Astro, Vite and plain HTML.
- A cursor roster from `models.dev`, so the cursors are named after current LLMs.
- Auto-tour scrolling with pause on scroll up and resume on scroll down.
- The zero-flash first-paint cover.
- Per-route `sessionStorage` tracking, and start/end events.

## License

The code added in this repo is MIT. The engine derives from the projects above, so check their licenses before redistributing it.
