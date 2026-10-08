export const COLORS = {
  sage: "#91b69d",
  blue: "#8cadd5",
  lavender: "#b29bcc",
  amber: "#d1b07d",
  rose: "#cf929d",
};

export function normalizeUrl(value) {
  const input = String(value).trim();
  if (!input || input.length > 8192)
    throw new Error("Enter a valid web address.");
  const url = new URL(
    /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`,
  );
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "Use an http or https web address without login credentials.",
    );
  }
  return url.href;
}

export function domain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function descendants(folders, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders)
      if (ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
  }
  return ids;
}

export function moveItem(library, kind, id, destination) {
  if (!["folder", "bookmark"].includes(kind))
    throw new Error("This item cannot be moved.");
  if (
    destination !== null &&
    !library.folders.some((f) => f.id === destination)
  )
    throw new Error("That folder no longer exists.");
  if (kind === "folder") {
    if (!library.folders.some((f) => f.id === id))
      throw new Error("That folder no longer exists.");
    if (descendants(library.folders, id).has(destination))
      throw new Error(
        "A folder cannot be moved into itself or one of its subfolders.",
      );
    return {
      ...library,
      folders: library.folders.map((f) =>
        f.id === id ? { ...f, parentId: destination } : f,
      ),
    };
  }
  if (!library.bookmarks.some((b) => b.id === id))
    throw new Error("That bookmark no longer exists.");
  return {
    ...library,
    bookmarks: library.bookmarks.map((b) =>
      b.id === id ? { ...b, folderId: destination } : b,
    ),
  };
}

export function validateLibrary(input) {
  if (
    !input ||
    input.version !== 1 ||
    !Array.isArray(input.folders) ||
    !Array.isArray(input.bookmarks)
  )
    throw new Error("This is not a valid Folio backup.");
  if (input.folders.length > 10000 || input.bookmarks.length > 100000)
    throw new Error("This library is too large.");
  const ids = new Set();
  const checkId = (id) => {
    if (typeof id !== "string" || !id || id.length > 120 || ids.has(id))
      throw new Error("The library has invalid or duplicate IDs.");
    ids.add(id);
  };
  const text = (value, max, required = false) => {
    if (
      typeof value !== "string" ||
      value.length > max ||
      (required && !value.trim())
    )
      throw new Error("The library contains invalid text.");
    return value;
  };
  const folders = input.folders.map((f) => {
    checkId(f.id);
    return {
      id: f.id,
      name: text(f.name, 150, true),
      parentId: f.parentId,
      color: Object.hasOwn(COLORS, f.color) ? f.color : null,
    };
  });
  const folderIds = new Set(folders.map((f) => f.id));
  const parents = new Map(folders.map((f) => [f.id, f.parentId]));
  for (const f of folders) {
    if (f.parentId !== null && !folderIds.has(f.parentId))
      throw new Error("A folder has a missing parent.");
    const visited = new Set([f.id]);
    let parent = f.parentId;
    while (parent !== null) {
      if (visited.has(parent))
        throw new Error("The library contains a folder cycle.");
      visited.add(parent);
      parent = parents.get(parent);
    }
  }
  const bookmarks = input.bookmarks.map((b) => {
    checkId(b.id);
    if (b.folderId !== null && !folderIds.has(b.folderId))
      throw new Error("A bookmark has a missing folder.");
    return {
      id: b.id,
      title: text(b.title, 300, true),
      url: normalizeUrl(b.url),
      description: text(b.description ?? "", 2000),
      folderId: b.folderId,
      favorite: Boolean(b.favorite),
      createdAt: Number.isFinite(b.createdAt) ? b.createdAt : Date.now(),
    };
  });
  return { version: 1, folders, bookmarks };
}

export function createLibrary() {
  const folders = [
    { id: "design", name: "Design", parentId: null, color: "sage" },
    { id: "inspiration", name: "Inspiration", parentId: "design", color: null },
    { id: "typography", name: "Typography", parentId: "design", color: null },
    { id: "development", name: "Development", parentId: null, color: "blue" },
    { id: "reading", name: "Reading list", parentId: null, color: null },
    { id: "personal", name: "Personal", parentId: null, color: null },
  ];
  const seeds = [
    [
      "Figma",
      "https://www.figma.com",
      "A space to bring ideas to life.",
      "design",
      true,
    ],
    [
      "Are.na",
      "https://www.are.na",
      "Collect ideas. Connect the dots.",
      "design",
      false,
    ],
    [
      "Dribbble",
      "https://dribbble.com",
      "A daily dose of creative inspiration.",
      "design",
      false,
    ],
    [
      "Mobbin",
      "https://mobbin.com",
      "Thoughtful interfaces, down to the details.",
      "design",
      true,
    ],
    [
      "Coolors",
      "https://coolors.co",
      "Find the colors that feel just right.",
      "design",
      false,
    ],
    [
      "The Brand Identity",
      "https://the-brandidentity.com",
      "Independent graphic design and culture.",
      "design",
      false,
    ],
    [
      "Layers",
      "https://layers.to",
      "A closer look at the creative process.",
      "design",
      false,
    ],
    [
      "Lucide",
      "https://lucide.dev",
      "Beautiful, consistent, open-source icons.",
      "design",
      false,
    ],
    [
      "Awwwards",
      "https://www.awwwards.com",
      "Remarkable websites worth exploring.",
      "inspiration",
      false,
    ],
    [
      "Godly",
      "https://godly.website",
      "Web design from a different perspective.",
      "inspiration",
      false,
    ],
    [
      "Google Fonts",
      "https://fonts.google.com",
      "Type for every kind of idea.",
      "typography",
      true,
    ],
    [
      "GitHub",
      "https://github.com",
      "A home for code and collaboration.",
      "development",
      true,
    ],
    [
      "MDN Web Docs",
      "https://developer.mozilla.org",
      "The web, well documented.",
      "development",
      false,
    ],
    [
      "Smashing Magazine",
      "https://www.smashingmagazine.com",
      "Practical thoughts on design and the web.",
      "reading",
      false,
    ],
  ];
  return {
    version: 1,
    folders,
    bookmarks: seeds.map(
      ([title, url, description, folderId, favorite], i) => ({
        id: `starter-${i}`,
        title,
        url,
        description,
        folderId,
        favorite,
        createdAt: Date.now() - i * 3600000,
      }),
    ),
  };
}
