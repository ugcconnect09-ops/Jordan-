import { renderHome, renderVertical, renderFooter, showError } from "./render.js";
import { initChrome, initContentMotion } from "./motion.js";
import { countUp } from "./stats.js";
import { initForm } from "./form.js";

const page = document.body.dataset.page;
const dataUrl = page === "home" ? "/data/home.json" : `/data/pages/${page}.json`;

async function getJSON(url) {
  const res = await fetch(url); // default caching on purpose
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function main() {
  initChrome(); // header + menu work even if the data fails to load
  try {
    const [site, data] = await Promise.all([getJSON("/data/site.json"), getJSON(dataUrl)]);
    if (page === "home") renderHome(data, site);
    else renderVertical(data);
    renderFooter(site);
    initForm();
    initContentMotion(countUp); // after ALL content exists
  } catch (err) {
    console.warn("Page content failed to load:", err);
    showError();
    document.querySelectorAll(".reveal, .reveal-scale").forEach((n) => n.classList.add("in"));
  }
}

main();
