// Safe rendering of the JSON content. CMS strings only ever go in through textContent / setAttribute.
// A missing or empty field means "skip that element". A bad list item is skipped with a console.warn.

import { parseVideo, embedSrc, ytThumb } from "./video.js";

export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid);
  return n;
}

export function safeUrl(u, { allowMailto = false } = {}) {
  if (typeof u !== "string" || !u.trim()) return null;
  const s = u.trim();
  if (s.startsWith("/") && !s.startsWith("//")) return s; // same-site path
  try {
    const x = new URL(s);
    if (x.protocol === "https:" || (allowMailto && x.protocol === "mailto:")) return x.href;
  } catch { /* invalid */ }
  return null;
}

/* ---------- small helpers ---------- */

const str = (v) => (typeof v === "string" ? v.trim() : "");
const arr = (v) => (Array.isArray(v) ? v : []);
const paras = (v) => str(v).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
const SVG_NS = "http://www.w3.org/2000/svg";

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export const NAV = [
  { href: "/hospitality-travel/", label: "Hospitality & Travel" },
  { href: "/culinary-dining/", label: "Culinary & Dining" },
  { href: "/style-grooming/", label: "Style & Grooming" },
  { href: "/#contact", label: "Contact" },
];

const VERTICALS = [
  { key: "hospitality_travel", title: "Hospitality & Travel", href: "/hospitality-travel/" },
  { key: "culinary_dining", title: "Culinary & Dining", href: "/culinary-dining/" },
  { key: "style_grooming", title: "Style & Grooming", href: "/style-grooming/" },
];

// Image that quietly disappears if the file is missing, so the dark placeholder behind it shows instead.
function photo(src, alt, { w = 1600, h = 1000, eager = false } = {}) {
  const url = safeUrl(src);
  if (!url) return null;
  const img = el("img", {
    src: url,
    alt: str(alt),
    width: w,
    height: h,
    decoding: "async",
    loading: eager ? null : "lazy",
    fetchpriority: eager ? "high" : null,
  });
  img.addEventListener("error", () => img.remove(), { once: true });
  return img;
}

function head(eyebrow, title, { level = 2, cls = "" } = {}) {
  const kids = [];
  if (str(eyebrow)) kids.push(el("p", { class: "eyebrow", text: str(eyebrow) }));
  if (str(title)) kids.push(el(`h${level}`, { class: "display h-section", text: str(title) }));
  return kids.length ? el("div", { class: `section-head reveal ${cls}`.trim() }, kids) : null;
}

function wrap(...kids) {
  return el("div", { class: "wrap" }, kids.flat().filter(Boolean));
}

function proseBlock(body) {
  const ps = paras(body);
  return ps.length ? el("div", { class: "prose" }, ps.map((t) => el("p", { text: t }))) : null;
}

/* ---------- hero ---------- */

function renderHero(root, hero, { home }) {
  if (!hero) return;
  const media = el("div", { class: "hero__media" });
  const img = photo(hero.image ?? hero.hero_image, hero.image_alt ?? hero.hero_image_alt, { w: 2400, h: 1600, eager: true });
  if (img) media.append(img);
  const inner = el("div", { class: "wrap hero__inner" }, [
    str(hero.eyebrow) ? el("p", { class: "eyebrow reveal", text: str(hero.eyebrow) }) : null,
    str(hero.headline) ? el("h1", { class: "display h-hero reveal", text: str(hero.headline) }) : null,
    str(hero.intro) ? el("p", { class: "lede reveal", text: str(hero.intro) }) : null,
    home ? el("div", { class: "hero__actions reveal" }, el("a", { class: "btn btn--primary", href: "#contact", text: "Brand inquiries" })) : null,
  ]);
  root.replaceChildren(media, el("div", { class: "hero__scrim" }), inner, home ? el("span", { class: "scroll-cue", "aria-hidden": "true" }) : null);
}

/* ---------- home sections ---------- */

// Logos are shown as one-colour light silhouettes, which needs a transparent background.
// If a raster logo has a solid (white/black) background, turn the background into transparency here,
// and trim empty margins, so the logo is not drawn as a grey box. A transparent PNG/SVG is still the best source.
function cleanLogo(img) {
  try {
    if (img.dataset.clean || /\.svg(\?|$)/i.test(img.getAttribute("src") || "")) return;
    img.dataset.clean = "1";
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) return;
    const k = Math.min(1, 700 / w0);
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const lumAt = (i) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];

    let minA = 255, sum = 0, n = 0;
    const edge = (x, y) => { const i = (y * w + x) * 4; minA = Math.min(minA, px[i + 3]); sum += lumAt(i); n++; };
    for (let x = 0; x < w; x++) { edge(x, 0); edge(x, h - 1); }
    for (let y = 0; y < h; y++) { edge(0, y); edge(w - 1, y); }

    if (minA >= 250) { // opaque edges = solid background: keep only what differs from it
      const bg = sum / n, lightBg = bg > 128;
      for (let i = 0; i < px.length; i += 4) {
        const l = lumAt(i);
        let a = lightBg ? ((bg - l) / Math.max(bg, 1)) * 255 : ((l - bg) / Math.max(255 - bg, 1)) * 255;
        a = a < 14 ? 0 : Math.min(255, a * 1.15); // drop JPEG noise, keep edges crisp
        px[i] = px[i + 1] = px[i + 2] = 255;
        px[i + 3] = a;
      }
    }

    let x0 = w, y0 = h, x1 = -1, y1 = -1; // bounding box of what is visible
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return; // nothing visible: leave the original alone
    ctx.putImageData(data, 0, 0);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const out = document.createElement("canvas");
    out.width = cw; out.height = ch;
    out.getContext("2d").drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
    img.src = out.toDataURL("image/png");
  } catch (err) {
    console.warn("Could not clean logo, showing it as is:", err); // e.g. file:// preview blocks canvas
  }
}

function renderLogos(root, home) {
  const logos = arr(home.logos).filter((l) => l && l.visible !== false && str(l.name) && safeUrl(l.image));
  if (!logos.length) return;
  const list = el("ul", { class: "logos" });
  for (const l of logos) {
    const img = el("img", { src: safeUrl(l.image), alt: str(l.name), width: 176, height: 44, decoding: "async" });
    const item = el("li", { class: "logo reveal" }, img);
    img.addEventListener("load", () => cleanLogo(img));
    img.addEventListener("error", () => img.replaceWith(el("span", { class: "logo__text", text: str(l.name) })), { once: true });
    list.append(item);
  }
  const title = str(home.logos_heading);
  root.replaceChildren(wrap(title ? el("p", { class: "eyebrow trust__head reveal", text: title }) : null, list));
}

function statNode(s) {
  const value = str(s.value);
  return el("div", { class: "stat reveal" }, [
    str(s.tag) ? el("p", { class: "eyebrow", text: str(s.tag) }) : null,
    el("p", { class: "stat__value" }, [
      el("span", { "aria-hidden": "true", "data-stat": value, text: value }), // final text is already in place
      el("span", { class: "sr-only", text: value }),
    ]),
    el("p", { class: "stat__label", text: str(s.label) }),
  ]);
}

const STATS_PERIOD_DEFAULT = "Past 28 Days Performance";

function renderStats(root, home) {
  const stats = arr(home.stats).filter((s) => s && str(s.value) && str(s.label));
  if (!stats.length) return;
  const [lead, ...rest] = stats;
  // Time-period badge beside the section title. Shows the default text when "stats_period" is missing
  // from the JSON; set "stats_period" to "" (empty) to hide it.
  const period = typeof home.stats_period === "string" ? home.stats_period.trim() : STATS_PERIOD_DEFAULT;
  const badge = period ? el("p", { class: "badge reveal" }, [el("span", { class: "badge__dot", "aria-hidden": "true" }), period]) : null;
  const title = head("Impact", home.stats_heading);
  const top = title || badge ? el("div", { class: "stats-head" }, [title, badge]) : null;
  root.replaceChildren(wrap(
    top,
    el("div", { class: "stats-lead" }, statNode(lead)),
    rest.length ? el("div", { class: "stats-grid" }, rest.map(statNode)) : null,
  ));
}

function renderAudience(root, home) {
  const a = home.audience;
  if (!a) return;
  const markets = arr(a.markets).map(str).filter(Boolean);
  const cells = [];
  if (str(a.age_range)) cells.push(el("div", { class: "audience__cell reveal" }, [el("p", { class: "eyebrow", text: "Ages" }), el("p", { class: "audience__value", text: str(a.age_range) })]));
  if (str(a.gender)) cells.push(el("div", { class: "audience__cell reveal" }, [el("p", { class: "eyebrow", text: "Audience" }), el("p", { class: "audience__value", text: str(a.gender) })]));
  if (markets.length) cells.push(el("div", { class: "audience__cell reveal" }, [el("p", { class: "eyebrow", text: "Key markets" }), el("ul", { class: "markets" }, markets.map((m) => el("li", { text: m })))]));
  if (!cells.length) return;
  root.replaceChildren(wrap(head("Reach", "Audience & key markets"), el("div", { class: "audience" }, cells)));
}

function renderVerticals(root, home) {
  const cards = home.vertical_cards || {};
  const nodes = VERTICALS.map((v) => {
    const c = cards[v.key] || {};
    const img = photo(c.image, c.image_alt, { w: 1200, h: 1500 });
    return el("a", { class: "card", href: v.href }, [
      el("div", { class: "card__media reveal-scale" }, img),
      el("div", { class: "card__body reveal" }, [
        el("h3", { class: "display h-card", text: v.title }),
        str(c.blurb) ? el("p", { text: str(c.blurb) }) : null,
        el("span", { class: "card__more" }, ["Explore", el("span", { "aria-hidden": "true", text: "→" })]),
      ]),
    ]);
  });
  root.replaceChildren(wrap(head("Explore", "Verticals"), el("div", { class: "cards" }, nodes)));
}

function renderAbout(root, home) {
  const a = home.about;
  if (!a) return;
  const body = proseBlock(a.body);
  if (!str(a.heading) && !body) return;
  root.replaceChildren(wrap(el("div", { class: "about" }, [
    el("div", { class: "section-head reveal", style: "margin:0" }, [
      el("p", { class: "eyebrow", text: "About" }),
      str(a.heading) ? el("h2", { class: "display h-section", text: str(a.heading) }) : null,
    ]),
    body ? el("div", { class: "reveal" }, body) : null,
  ])));
}

function socialsList(site) {
  const items = arr(site.socials).filter((s) => s && safeUrl(s.url) && str(s.platform));
  if (!items.length) return null;
  return el("ul", { class: "socials" }, items.map((s) =>
    el("li", {}, el("a", { href: safeUrl(s.url), target: "_blank", rel: "noopener noreferrer" }, [
      el("span", { class: "eyebrow", text: str(s.platform) }),
      el("span", { text: str(s.handle) }),
    ]))));
}

// The contact form itself is static HTML (it must work without JS); this only fills in the editable text.
function renderContact(home, site) {
  const c = home.contact || {};
  const h = document.getElementById("contact-heading");
  if (h && str(c.heading)) h.textContent = str(c.heading);
  const intro = document.getElementById("contact-intro");
  if (intro) { if (str(c.intro)) intro.textContent = str(c.intro); else intro.remove(); }
  const slot = document.getElementById("contact-socials");
  if (slot) {
    const list = socialsList(site);
    const mail = str(site.contact_email_display);
    const mailHref = EMAIL.test(mail) ? safeUrl(`mailto:${mail}`, { allowMailto: true }) : null;
    slot.replaceChildren(...[
      mailHref ? el("p", {}, el("a", { class: "eyebrow", href: mailHref, text: mail })) : null,
      list,
    ].filter(Boolean));
  }
}

/* ---------- vertical pages ---------- */

function renderTextBlocks(root, data) {
  const blocks = arr(data.text_blocks).filter((b) => b && (str(b.heading) || str(b.body)));
  if (!blocks.length) return;
  root.replaceChildren(wrap(blocks.map((b) => {
    const body = proseBlock(b.body);
    return el("div", { class: `text-block${str(b.heading) ? "" : " text-block--solo"}` }, [
      str(b.heading) ? el("h2", { class: "display h-card reveal", text: str(b.heading) }) : null,
      body ? el("div", { class: "reveal" }, body) : null,
    ]);
  })));
}

function playIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M6 3.5v17l14-8.5z");
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

function videoCard(item) {
  if (!item) return null;
  const url = safeUrl(item.url);
  const v = url && parseVideo(url);
  if (!v) { console.warn("Skipped video with an invalid link:", item.url); return null; }

  const orientation = item.layout === "wide" || item.layout === "vertical" ? item.layout : v.orientation;
  const title = str(item.title) || "Video";
  const providerName = v.provider === "youtube" ? "YouTube" : "TikTok";
  const box = el("div", { class: `video video--${orientation}${v.provider === "tiktok" && orientation === "vertical" ? " video--tiktok" : ""}` });

  const facade = el("button", { class: "video__facade", type: "button", "aria-label": `Play: ${title}` });
  const thumbSrc = safeUrl(item.cover) || (v.provider === "youtube" ? ytThumb(v.id) : null);
  if (thumbSrc) {
    const thumb = el("img", { src: thumbSrc, alt: "", loading: "lazy", decoding: "async", width: 480, height: 360 });
    thumb.addEventListener("error", () => thumb.remove(), { once: true }); // fall back to the dark card
    facade.append(thumb);
  }
  facade.append(el("span", { class: "video__play" }, playIcon()), el("span", { class: "video__title", text: title }));
  facade.addEventListener("click", () => {
    const frame = el("iframe", {
      src: embedSrc(v, true),
      title,
      allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
      allowfullscreen: true,
      referrerpolicy: "strict-origin-when-cross-origin",
    });
    facade.replaceWith(frame);
    frame.focus();
  });
  box.append(facade);

  const meta = el("div", { class: "video-meta" }, [
    str(item.caption) ? el("p", { class: "video-meta__caption", text: str(item.caption) }) : null,
    el("a", { href: url, target: "_blank", rel: "noopener noreferrer", text: `Watch on ${providerName}` }),
  ]);
  return { orientation, node: el("div", { class: "video-item reveal" }, [box, meta]) };
}

function renderVideos(root, data) {
  const cards = arr(data.videos).map(videoCard).filter(Boolean);
  if (!cards.length) return;
  const wide = cards.filter((c) => c.orientation === "wide").map((c) => c.node);
  const vertical = cards.filter((c) => c.orientation === "vertical").map((c) => c.node);
  root.replaceChildren(wrap(
    el("h2", { class: "sr-only", text: "Videos" }),
    el("div", { class: "videos-wide" }, wide),
    el("div", { class: "videos-vertical" }, vertical),
  ));
}

function renderGallery(root, data) {
  const items = arr(data.gallery).map((g) => {
    const img = g && photo(g.image, g.alt, { w: 1200, h: 1500 });
    return img ? el("div", { class: "gallery__item reveal-scale" }, img) : null;
  }).filter(Boolean);
  if (!items.length) return;
  root.replaceChildren(el("div", { class: "gallery" }, el("div", { class: "gallery__track" }, items)));
}

/* ---------- footer ---------- */

export function renderFooter(site) {
  const root = document.getElementById("footer");
  if (!root || !site) return;
  const mail = str(site.contact_email_display);
  const mailHref = EMAIL.test(mail) ? safeUrl(`mailto:${mail}`, { allowMailto: true }) : null;
  const socials = arr(site.socials).filter((s) => s && safeUrl(s.url) && str(s.platform));
  root.replaceChildren(wrap(
    el("div", { class: "footer__grid" }, [
      el("div", {}, [
        str(site.brand_name) ? el("p", { class: "footer__brand", text: str(site.brand_name) }) : null,
        str(site.management) ? el("p", { class: "footer__meta", text: str(site.management) }) : null,
      ]),
      el("nav", { class: "footer__col", "aria-label": "Pages" }, NAV.map((n) => el("a", { href: n.href, text: n.label }))),
      el("div", { class: "footer__col" }, [
        mailHref ? el("a", { href: mailHref, text: mail }) : null,
        ...socials.map((s) => el("a", { href: safeUrl(s.url), target: "_blank", rel: "noopener noreferrer", text: `${str(s.platform)} ${str(s.handle)}`.trim() })),
      ]),
    ]),
    str(site.footer_note) ? el("p", { class: "footer__note", text: str(site.footer_note) }) : null,
  ));
}

/* ---------- page entry points ---------- */

// Each section is isolated: one bad section never stops the rest of the page.
function guard(name, fn) {
  try { fn(); } catch (err) { console.warn(`Could not render "${name}":`, err); }
}
const $ = (id) => document.getElementById(id);

export function renderHome(home, site) {
  guard("hero", () => renderHero($("hero"), home.hero, { home: true }));
  guard("logos", () => renderLogos($("logos"), home));
  guard("stats", () => renderStats($("stats"), home));
  guard("audience", () => renderAudience($("audience"), home));
  guard("verticals", () => renderVerticals($("verticals"), home));
  guard("about", () => renderAbout($("about"), home));
  guard("contact", () => renderContact(home, site));
}

export function renderVertical(data) {
  guard("hero", () => renderHero($("hero"), data, { home: false }));
  guard("text", () => renderTextBlocks($("intro"), data));
  guard("videos", () => renderVideos($("videos"), data));
  guard("gallery", () => renderGallery($("gallery"), data));
}

export function showError() {
  const main = $("main");
  if (!main) return;
  main.prepend(el("p", { class: "notice", role: "alert", text: "This page could not be loaded right now. Please refresh in a moment." }));
}