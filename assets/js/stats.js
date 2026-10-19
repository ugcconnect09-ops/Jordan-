// Count-up for stat strings such as "500K+", "4.1%", "2.1K+". Always ends on the exact original string.

export function parseStat(raw) {
  const m = String(raw).trim().match(/^([^\d]*)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  return {
    prefix: m[1],
    num: parseFloat(m[2].replace(/,/g, "")),
    decimals: (m[2].split(".")[1] || "").length,
    grouping: m[2].includes(","),
    suffix: m[3],
  };
}

export function countUp(node, raw, ms = 1600) {
  const p = parseStat(raw);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!p || reduce) { node.textContent = raw; return; }
  const fmt = (n) =>
    p.prefix +
    n.toLocaleString("en-US", { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals, useGrouping: p.grouping }) +
    p.suffix;
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min((now - t0) / ms, 1);
    const eased = 1 - Math.pow(1 - k, 3);
    node.textContent = k < 1 ? fmt(p.num * eased) : raw; // always end on the exact original string
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
