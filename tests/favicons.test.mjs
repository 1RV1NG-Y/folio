import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFaviconLoader } from "../electron/favicons.cjs";

test("favicon discovery follows declared icons and caches them for offline reuse", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "folio-icons-"));
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(url);
    if (url.endsWith("/favicon.ico"))
      return new Response("missing", { status: 404 });
    if (url.endsWith("/logo.svg"))
      return new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
        headers: { "content-type": "image/svg+xml" },
      });
    const response = new Response(
      '<html><head><link rel="icon" href="/logo.svg"></head></html>',
      { headers: { "content-type": "text/html" } },
    );
    Object.defineProperty(response, "url", { value: "https://example.com/" });
    return response;
  };
  try {
    const loader = createFaviconLoader(dir);
    const icon = await loader("https://example.com/a-private-path");
    assert.ok(icon.startsWith("data:image/svg+xml;base64,"));
    assert.deepEqual(requested, [
      "https://example.com/favicon.ico",
      "https://example.com",
      "https://example.com/logo.svg",
    ]);
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    assert.equal(
      await createFaviconLoader(dir)("https://example.com/another"),
      icon,
    );
    assert.equal(await loader("file:///etc/passwd"), null);
    assert.equal(await loader("https://user:pass@example.com"), null);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
});

test("failed or non-image favicon responses return the fallback without caching HTML", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "folio-icons-failed-"));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<html>Not an icon</html>", {
      headers: { "content-type": "text/html" },
    });
  try {
    assert.equal(await createFaviconLoader(dir)("https://example.com"), null);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
});
