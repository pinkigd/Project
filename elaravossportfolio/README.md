# Elara Voss — Portfolio Landing Page

A modern, award-style landing page for a fictional UI/UX designer, built with
vanilla HTML/CSS/JS, **GSAP + ScrollTrigger**, **Lenis** smooth scrolling and a
**Three.js** WebGL hero scene.

## Running locally

No build step — just serve the folder over HTTP (required for the ES-module
Three.js scene):

```bash
python3 -m http.server 8090
# → http://localhost:8090
```

## Highlights

- **Preloader** with progress counter and curtain reveal into a staggered
  char-by-char hero title animation.
- **WebGL hero** — a simplex-noise-displaced particle sphere (custom GLSL
  shaders) with mouse parallax. Rendering pauses when the hero leaves the
  viewport or the tab is hidden; pixel ratio and particle density are reduced
  on touch devices; falls back to plain CSS if WebGL is unavailable.
- **Smooth scrolling** via Lenis driven by GSAP's ticker, wired into
  ScrollTrigger.
- **Scroll choreography** — masked char reveals on section titles, a scrubbed
  word-by-word about statement, animated stat counters and an infinite marquee.
- **Desktop interactions** — custom cursor with a "View" state, magnetic nav
  links, and floating gradient work previews that follow the pointer.
- **Mobile-friendly** — fullscreen animated menu, inline work thumbnails
  instead of hover previews, `100svh` hero, fluid `clamp()` type scale verified
  down to 344 px wide with no overflow or clipped headlines.
- **Accessible & resilient** — respects `prefers-reduced-motion`, semantic
  landmarks, `aria-expanded`/`aria-hidden` on the menu, and full content
  visibility without JavaScript.

All dependencies (GSAP, ScrollTrigger, Lenis, Three.js) and fonts
(Syne, Inter — via Fontsource) are vendored locally in `vendor/` and `fonts/`,
so the page works fully offline.
