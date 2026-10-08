import test from "node:test";
import assert from "node:assert/strict";
import {
  createLibrary,
  descendants,
  moveItem,
  normalizeUrl,
  validateLibrary,
} from "../src/model.mjs";

test("URL normalization accepts web links and rejects unsafe schemes and credentials", () => {
  assert.equal(
    normalizeUrl("example.com/path?q=1"),
    "https://example.com/path?q=1",
  );
  assert.equal(normalizeUrl("http://localhost:3000"), "http://localhost:3000/");
  for (const url of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:text/html,hi",
    "https://user:password@example.com",
    "",
    "not a url",
  ])
    assert.throws(() => normalizeUrl(url));
});

test("moving nested folders preserves links and prevents folder cycles", () => {
  const library = createLibrary();
  assert.deepEqual(
    [...descendants(library.folders, "design")],
    ["design", "inspiration", "typography"],
  );
  assert.throws(
    () => moveItem(library, "folder", "design", "inspiration"),
    /cannot be moved/,
  );
  assert.throws(
    () => moveItem(library, "folder", "design", "design"),
    /cannot be moved/,
  );
  assert.throws(
    () => moveItem(library, "folder", "design", "missing"),
    /no longer exists/,
  );
  const next = moveItem(library, "folder", "design", "personal");
  assert.equal(
    next.folders.find((f) => f.id === "design").parentId,
    "personal",
  );
  assert.equal(
    next.bookmarks.find((b) => b.id === "starter-0").folderId,
    "design",
  );
  assert.equal(library.folders.find((f) => f.id === "design").parentId, null);
  assert.doesNotThrow(() => validateLibrary(next));
});

test("bookmarks can move to a folder or Unfiled without changing metadata", () => {
  const library = createLibrary();
  const moved = moveItem(library, "bookmark", "starter-0", null);
  assert.deepEqual(moved.bookmarks[0], {
    ...library.bookmarks[0],
    folderId: null,
  });
  assert.throws(() => moveItem(library, "bookmark", "missing", null));
  assert.throws(() => moveItem(library, "unknown", "starter-0", null));
});

test("backups round-trip and invalid libraries are rejected before saving", () => {
  const library = createLibrary();
  assert.equal(
    validateLibrary(JSON.parse(JSON.stringify(library))).bookmarks.length,
    14,
  );
  const cycle = createLibrary();
  cycle.folders[0].parentId = "inspiration";
  assert.throws(() => validateLibrary(cycle), /cycle/);
  const orphan = createLibrary();
  orphan.bookmarks[0].folderId = "missing";
  assert.throws(() => validateLibrary(orphan), /missing folder/);
  const duplicate = createLibrary();
  duplicate.bookmarks[0].id = "design";
  assert.throws(() => validateLibrary(duplicate), /duplicate/);
  const invalid = createLibrary();
  invalid.bookmarks[0].url = "javascript:alert(1)";
  assert.throws(() => validateLibrary(invalid));
  assert.throws(() => validateLibrary({ folders: [], bookmarks: [] }));
  assert.deepEqual(
    validateLibrary({ version: 1, folders: [], bookmarks: [] }),
    { version: 1, folders: [], bookmarks: [] },
  );
});
