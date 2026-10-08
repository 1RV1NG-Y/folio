const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

// Icons are requested directly from the bookmarked website, never an icon aggregator.
function createFaviconLoader(directory) {
  const pending = new Map();
  async function getBytes(response, maxBytes) {
    if (!response.ok) throw new Error("Icon request failed");
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > maxBytes) throw new Error("Response too large");
        chunks.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return Buffer.concat(chunks);
  }
  async function request(url) {
    if (!["https:", "http:"].includes(new URL(url).protocol))
      throw new Error("Invalid icon address");
    return fetch(url, {
      signal: AbortSignal.timeout(5000),
      credentials: "omit",
      headers: { "User-Agent": "Folio/1.0 Bookmark Icon Loader" },
    });
  }
  async function image(url) {
    const response = await request(url);
    const mime = (response.headers.get("content-type") || "").split(";")[0];
    if (
      ![
        "image/x-icon",
        "image/vnd.microsoft.icon",
        "image/png",
        "image/jpeg",
        "image/svg+xml",
        "image/webp",
        "image/gif",
        "image/avif",
      ].includes(mime)
    )
      throw new Error("Not an icon");
    const bytes = await getBytes(response, 512 * 1024);
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }
  async function resolve(origin) {
    const cacheFile = path.join(
      directory,
      `${createHash("sha256").update(origin).digest("hex")}.json`,
    );
    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, "utf8"));
      if (Date.now() - cached.savedAt < 30 * 86400000) return cached.data;
    } catch {
      /* Resolve a fresh icon if the cache is absent or stale. */
    }
    let data = null;
    try {
      data = await image(`${origin}/favicon.ico`);
    } catch {
      /* Modern sites often declare their icon in the page head. */
    }
    if (!data) {
      try {
        const response = await request(origin);
        const base = response.url;
        const html = (await getBytes(response, 2 * 1024 * 1024)).toString(
          "utf8",
        );
        const links = [...html.matchAll(/<link\b[^>]*>/gi)]
          .map((match) => {
            const attrs = Object.fromEntries(
              [
                ...match[0].matchAll(
                  /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
                ),
              ].map((m) => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]),
            );
            return /^(?:shortcut\s+)?icon$|^apple-touch-icon$/i.test(
              attrs.rel || "",
            ) && attrs.href
              ? new URL(attrs.href.replaceAll("&amp;", "&"), base).href
              : null;
          })
          .filter(Boolean);
        for (const url of links.slice(0, 4)) {
          try {
            data = await image(url);
            break;
          } catch {
            /* Try the next declared icon. */
          }
        }
      } catch {
        /* The renderer shows an offline-friendly initial. */
      }
    }
    if (data) {
      try {
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(
          cacheFile,
          JSON.stringify({ savedAt: Date.now(), data }),
        );
      } catch {
        /* Cache writes are optional. */
      }
    }
    return data;
  }
  return (value) => {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return Promise.resolve(null);
    if (!pending.has(url.origin)) pending.set(url.origin, resolve(url.origin));
    return pending.get(url.origin);
  };
}
module.exports = { createFaviconLoader };
