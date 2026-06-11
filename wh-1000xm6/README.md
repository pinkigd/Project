# Sony WH-1000XM6 — Cinematic Scrollytelling Experience

An Apple-level, dark-mode product story for the WH-1000XM6: a sticky full-screen
canvas plays a scroll-driven disassembly of the headphones into a floating
technical diagram and reassembles them, synchronized with five copywriting beats.

> Concept experience — not an official Sony page.

## Run it

No build step, no dependencies to install:

```bash
npx http-server wh-1000xm6 -p 8080
# or: python3 -m http.server 8080 --directory wh-1000xm6
```

Then open <http://localhost:8080>.

## How it works

- **`js/render.js`** — procedural canvas renderer. The headphones (headband,
  yokes, shells, cushions, 30 mm drivers, magnets, baffles, mic array, PCB,
  battery) are drawn in a 1600×1000 virtual space. A single scroll-progress
  value drives a staggered explosion choreography, per-section accent lighting
  (cyan mic/processor glow during the noise-cancelling beat, voice-coil glow
  during the sound beat) and hairline-and-label technical callouts at peak
  explosion. Rendering is continuous and resolution-independent, so the
  "image sequence" never flickers or jumps between frames.
- **`js/main.js`** — scroll orchestration. Lenis smooth scrolling (CDN, with
  graceful fallback to native scroll when unavailable), a
  critically-damped progress lerp for buttery playback, story-beat
  opacity/transform windows, Apple-style nav fade-in, page progress hairline,
  and reveal-on-scroll for the specs/buy sections. Respects
  `prefers-reduced-motion`.
- **`css/style.css`** — design system: `#050505` / `#0a0a0c` backgrounds,
  Sony blue `#0050ff` → cyan `#00d6ff` accents, gradient-clipped display
  type (Inter variable), glassmorphism nav, gradient-border spec cards.

The canvas is transparent and the page background is the void the product
floats in, so the blend is seamless by construction.

## Story beats

| Scroll | Beat | State |
| --- | --- | --- |
| 0–15% | Hero — "Silence, perfected." | Assembled beauty shot, rim light, editorial tilt |
| 15–40% | "Precision-engineered for silence." | Soft explosion begins, internals materialize |
| 40–65% | "Adaptive noise cancelling, redefined." | Peak diagram, mic array + QN3 processor glow |
| 65–85% | "Immersive, lifelike sound." | Drivers, coils and magnets highlighted |
| 85–100% | "Hear everything. Feel nothing else." | Graceful reassembly + CTA |
