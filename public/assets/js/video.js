// Pure helpers: parse a pasted video link into {provider, id, orientation}, and build embed / thumbnail URLs.
// Only YouTube and TikTok are accepted. Anything else returns null.

const YT = /^[\w-]{11}$/;

export function parseVideo(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.split("/").filter(Boolean)[0] || "";
    return YT.test(id) ? { provider: "youtube", id, orientation: "wide" } : null;
  }
  if (host === "youtube.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" && YT.test(parts[1] || "")) return { provider: "youtube", id: parts[1], orientation: "vertical" };
    if (parts[0] === "embed" && YT.test(parts[1] || "")) return { provider: "youtube", id: parts[1], orientation: "wide" };
    if (parts[0] === "watch") {
      const id = u.searchParams.get("v") || "";
      if (YT.test(id)) return { provider: "youtube", id, orientation: "wide" };
    }
    return null;
  }
  if (host === "tiktok.com") {
    const m = u.pathname.match(/^\/@[\w.\-]+\/video\/(\d+)/);
    return m ? { provider: "tiktok", id: m[1], orientation: "vertical" } : null;
  }
  return null;
}

export function embedSrc(v, autoplay = true) {
  if (v.provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&playsinline=1${autoplay ? "&autoplay=1" : ""}`;
  }
  return `https://www.tiktok.com/embed/v2/${v.id}`;
}

export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
