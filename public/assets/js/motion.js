// Motion. Everything here is progressive: with reduced motion, or if this file fails, content is simply visible.

const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
const reduce = () => reduceQuery.matches;

/* Header shrink + mobile menu. Runs immediately, independent of the data fetch. */
export function initChrome() {
  const header = document.getElementById("site-header");
  if (header) {
    let ticking = false;
    const update = () => { ticking = false; header.classList.toggle("is-scrolled", window.scrollY > 40); };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  const btn = document.querySelector(".menu-btn");
  const menu = document.getElementById("menu");
  if (!btn || !menu) return;
  const label = btn.querySelector(".menu-btn__label");
  const setOpen = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
    document.documentElement.classList.toggle("menu-open", open);
    if (label) label.textContent = open ? "Close" : "Menu";
  };
  btn.addEventListener("click", () => setOpen(btn.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { setOpen(false); btn.focus(); }
  });
  matchMedia("(min-width: 861px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
}

/* Everything that needs the rendered content. Call only AFTER rendering (late elements would never be observed). */
export function initContentMotion(countUp) {
  initReveal();
  initCountUps(countUp);
  initParallax();
  initGalleryStrip();
}

function initReveal() {
  const els = [...document.querySelectorAll(".reveal, .reveal-scale")];
  if (reduce() || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      // The second clause covers very tall elements that can never reach 14% visible.
      if (e.isIntersecting && (e.intersectionRatio >= 0.14 || e.intersectionRect.height >= innerHeight * 0.2)) {
        io.unobserve(e.target);
        e.target.classList.add("in");
      }
    }
  }, { threshold: [0, 0.14] });
  els.forEach((e, i) => { e.style.transitionDelay = `${(i * 60) % 300}ms`; io.observe(e); });
}

function initCountUps(countUp) {
  const nodes = [...document.querySelectorAll("[data-stat]")];
  if (!nodes.length || reduce() || !("IntersectionObserver" in window) || typeof countUp !== "function") return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      countUp(e.target, e.target.dataset.stat);
    }
  }, { threshold: 0.6 });
  nodes.forEach((n) => io.observe(n));
}

function initParallax() {
  const img = document.querySelector(".hero__media img");
  if (!img || reduce()) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    if (y < innerHeight) img.style.transform = `scale(1.08) translateY(${(y * 0.15).toFixed(1)}px)`;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
}

// Photo strips only. Never video frames.
function initGalleryStrip() {
  const box = document.querySelector(".gallery");
  const track = box && box.querySelector(".gallery__track");
  if (!box || !track || reduce()) return;
  box.classList.add("gallery--linked");
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = box.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const max = Math.max(0, track.scrollWidth - box.clientWidth);
    const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
    track.style.transform = `translateX(${(-p * max).toFixed(1)}px)`;
  };
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue, { passive: true });
  update();
}
