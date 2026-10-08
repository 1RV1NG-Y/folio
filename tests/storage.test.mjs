import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStorage } from "../electron/storage.cjs";
import { createLibrary, validateLibrary } from "../src/model.mjs";

test("atomic disk storage serializes rapid saves and keeps the preceding backup", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "folio-storage-"));
  try {
    const store = createStorage(dir, validateLibrary);
    assert.equal(await store.load(), null);
    const library = createLibrary();
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        store.save({
          ...library,
          bookmarks: library.bookmarks.slice(0, i + 1),
        }),
      ),
    );
    await store.flush();
    assert.equal((await store.load()).bookmarks.length, 12);
    assert.equal(
      JSON.parse(await readFile(`${store.filename}.bak`, "utf8")).bookmarks
        .length,
      11,
    );
    assert.throws(() => store.save({ invalid: true }));
    assert.equal((await store.load()).bookmarks.length, 12);
    const reopened = createStorage(dir, validateLibrary);
    assert.equal((await reopened.load()).bookmarks.length, 12);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("corrupt saved data is reported and left untouched", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "folio-corrupt-"));
  try {
    const store = createStorage(dir, validateLibrary);
    await writeFile(store.filename, "unreadable library");
    await assert.rejects(store.load(), /kept intact/);
    assert.equal(await readFile(store.filename, "utf8"), "unreadable library");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
