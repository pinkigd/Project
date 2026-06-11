import { initScene } from "./scene.js";

document.documentElement.classList.add("js");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
// Testing override: ?pointer=fine|coarse forces the input mode
const pointerOverride = new URLSearchParams(location.search).get("pointer");
if (pointerOverride === "fine") finePointer = true;
if (pointerOverride === "coarse") finePointer = false;
document.documentElement.classList.add(finePointer ? "is-fine" : "is-coarse");

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------
   Smooth scroll (Lenis) driven by GSAP's ticker
   ------------------------------------------------------------ */
let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToTarget(hash) {
  const target = document.querySelector(hash);
  if (!target) return;
  if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
  else target.scrollIntoView({ behavior: "smooth" });
}

/* ------------------------------------------------------------
   Split text into animatable chars (keeps nested spans intact)
   ------------------------------------------------------------ */
function splitChars(el) {
  const chars = [];
  const nodes = [...el.childNodes];
  el.textContent = "";
  let word = null;
  const flushWord = () => (word = null);
  const getWord = () => {
    if (!word) {
      word = document.createElement("span");
      word.className = "word";
      el.appendChild(word);
    }
    return word;
  };
  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const ch of node.textContent) {
        if (ch === " " || ch === "\n" || ch === "\t") {
          flushWord();
          el.appendChild(document.createTextNode(" "));
          continue;
        }
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = ch;
        getWord().appendChild(span);
        chars.push(span);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "BR") {
      node.classList.add("char");
      getWord().appendChild(node); // glue to preceding word (e.g. "Voss\u00AE")
      chars.push(node);
    } else {
      flushWord();
      el.appendChild(node);
    }
  });
  return chars;
}

const splitTargets = new Map();
document.querySelectorAll("[data-split]").forEach((el) => {
  splitTargets.set(el, splitChars(el));
});

/* ------------------------------------------------------------
   Preloader → hero intro
   ------------------------------------------------------------ */
const preloader = document.querySelector(".preloader");
const counterEl = document.querySelector("[data-counter]");
const barEl = document.querySelector("[data-bar]");
const heroChars = [
  ...splitTargets.get(document.querySelectorAll(".hero__line")[0]),
  ...splitTargets.get(document.querySelectorAll(".hero__line")[1]),
];

function playIntro() {
  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  tl.to(preloader, {
    yPercent: -100,
    duration: 0.9,
    ease: "power3.inOut",
    onComplete: () => preloader.remove(),
  })
    .from("#webgl", { opacity: 0, duration: 1.6, ease: "power2.out" }, "-=0.4")
    .to(heroChars, { y: 0, duration: 1.1, stagger: 0.035 }, "-=1.3")
    .to(
      ".hero [data-reveal]",
      { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 },
      "-=0.7"
    )
    .from(".nav", { yPercent: -120, duration: 0.8 }, "-=0.8")
    .from(".hero__scroll", { opacity: 0, duration: 0.8 }, "-=0.5");
}

function runPreloader() {
  if (reducedMotion) {
    counterEl.textContent = "100";
    preloader.remove();
    gsap.set(".hero [data-reveal]", { opacity: 1, y: 0 });
    gsap.set(heroChars, { y: 0 });
    return;
  }
  const progress = { v: 0 };
  gsap.to(progress, {
    v: 100,
    duration: 1.8,
    ease: "power2.inOut",
    onUpdate: () => {
      counterEl.textContent = Math.round(progress.v);
      barEl.style.width = progress.v + "%";
    },
    onComplete: playIntro,
  });
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(runPreloader);
} else {
  window.addEventListener("load", runPreloader);
}

/* ------------------------------------------------------------
   Scroll-triggered reveals
   ------------------------------------------------------------ */
if (!reducedMotion) {
  // Section titles: chars rise in
  splitTargets.forEach((chars, el) => {
    if (el.closest(".hero")) return;
    gsap.to(chars, {
      y: 0,
      duration: 1,
      stagger: 0.03,
      ease: "power4.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  // Generic fade-up reveals outside the hero
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    if (el.closest(".hero")) return;
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%" },
    });
  });

  // Work rows slide in
  gsap.utils.toArray(".work__item").forEach((item, i) => {
    gsap.from(item, {
      opacity: 0,
      y: 50,
      duration: 1,
      delay: (i % 4) * 0.06,
      ease: "power3.out",
      scrollTrigger: { trigger: item, start: "top 92%" },
    });
  });

  // About statement: word-by-word scrub
  const statement = document.querySelector("[data-words]");
  if (statement) {
    const words = statement.textContent.trim().split(/\s+/);
    statement.innerHTML = words
      .map((w) => `<span class="w">${w}</span>`)
      .join(" ");
    gsap.to(statement.querySelectorAll(".w"), {
      opacity: 1,
      stagger: 0.06,
      ease: "none",
      scrollTrigger: {
        trigger: statement,
        start: "top 80%",
        end: "bottom 45%",
        scrub: 0.6,
      },
    });
  }

  // Stat counters
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    gsap.to(el, {
      textContent: target,
      duration: 1.6,
      snap: { textContent: 1 },
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  // Hero canvas parallax fade as you scroll past
  gsap.to("#webgl", {
    opacity: 0,
    yPercent: 12,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom 25%",
      scrub: true,
    },
  });

  // Marquee drift
  const track = document.querySelector("[data-marquee]");
  gsap.to(track, { xPercent: -50, duration: 22, ease: "none", repeat: -1 });
} else {
  document.querySelector("[data-words]")?.classList.add("is-static");
  document.querySelectorAll("[data-count]").forEach((el) => {
    el.textContent = el.dataset.count;
  });
}

/* ------------------------------------------------------------
   Floating work previews (desktop)
   ------------------------------------------------------------ */
if (finePointer) {
  const preview = document.querySelector(".preview");
  const imgs = {
    nova: document.querySelector(".preview__img--nova"),
    aether: document.querySelector(".preview__img--aether"),
    kinfolk: document.querySelector(".preview__img--kinfolk"),
    pulse: document.querySelector(".preview__img--pulse"),
  };
  const moveX = gsap.quickTo(preview, "x", { duration: 0.55, ease: "power3" });
  const moveY = gsap.quickTo(preview, "y", { duration: 0.55, ease: "power3" });
  const workSection = document.querySelector(".work");

  workSection.addEventListener("pointermove", (e) => {
    moveX(e.clientX);
    moveY(e.clientY);
  });

  document.querySelectorAll(".work__item").forEach((item) => {
    item.addEventListener("pointerenter", () => {
      Object.values(imgs).forEach((img) => img.classList.remove("is-active"));
      imgs[item.dataset.preview]?.classList.add("is-active");
      gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "power3.out" });
    });
    item.addEventListener("pointerleave", () => {
      gsap.to(preview, { autoAlpha: 0, scale: 0.92, duration: 0.35, ease: "power3.out" });
    });
  });
}

/* ------------------------------------------------------------
   Custom cursor + magnetic elements (desktop)
   ------------------------------------------------------------ */
if (finePointer && !reducedMotion) {
  const cursor = document.querySelector(".cursor");
  const cx = gsap.quickTo(cursor, "x", { duration: 0.18, ease: "power3" });
  const cy = gsap.quickTo(cursor, "y", { duration: 0.18, ease: "power3" });
  gsap.set(cursor, { xPercent: 0, yPercent: 0, opacity: 0 });

  window.addEventListener("pointermove", (e) => {
    cx(e.clientX);
    cy(e.clientY);
    gsap.to(cursor, { opacity: 1, duration: 0.3 });
  });
  document.documentElement.addEventListener("pointerleave", () => {
    gsap.to(cursor, { opacity: 0, duration: 0.3 });
  });

  document.querySelectorAll('[data-cursor="view"]').forEach((el) => {
    el.addEventListener("pointerenter", () => cursor.classList.add("is-view"));
    el.addEventListener("pointerleave", () => cursor.classList.remove("is-view"));
  });

  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    const strength = 0.35;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * strength,
        y: (e.clientY - (r.top + r.height / 2)) * strength,
        duration: 0.4,
        ease: "power3.out",
      });
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
    });
  });
} else {
  document.querySelector(".cursor")?.remove();
}

/* ------------------------------------------------------------
   Anchor navigation through Lenis
   ------------------------------------------------------------ */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const hash = a.getAttribute("href");
    if (hash.length < 2) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(hash);
  });
});

/* ------------------------------------------------------------
   Mobile menu
   ------------------------------------------------------------ */
const menu = document.querySelector(".menu");
const toggle = document.querySelector(".nav__toggle");
let menuOpen = false;

function openMenu() {
  menuOpen = true;
  toggle.setAttribute("aria-expanded", "true");
  toggle.querySelector(".nav__toggle-label").textContent = "Close";
  menu.setAttribute("aria-hidden", "false");
  lenis?.stop();
  gsap.set(menu, { visibility: "visible" });
  gsap.to(menu, { clipPath: "inset(0% 0 0% 0)", duration: 0.7, ease: "power4.inOut" });
  gsap.fromTo(
    ".menu__links a",
    { y: 40, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.6, stagger: 0.07, delay: 0.25, ease: "power3.out" }
  );
}

function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  toggle.setAttribute("aria-expanded", "false");
  toggle.querySelector(".nav__toggle-label").textContent = "Menu";
  menu.setAttribute("aria-hidden", "true");
  lenis?.start();
  gsap.to(menu, {
    clipPath: "inset(0 0 100% 0)",
    duration: 0.6,
    ease: "power4.inOut",
    onComplete: () => gsap.set(menu, { visibility: "hidden" }),
  });
}

toggle.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));

/* ------------------------------------------------------------
   Local time (Lisbon)
   ------------------------------------------------------------ */
function tickClock() {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  }).format(new Date());
  document.querySelectorAll("[data-clock]").forEach((el) => (el.textContent = time));
}
tickClock();
setInterval(tickClock, 30000);

/* ------------------------------------------------------------
   Three.js hero scene
   ------------------------------------------------------------ */
initScene({
  canvas: document.getElementById("webgl"),
  reducedMotion,
  isTouch: !finePointer,
});
