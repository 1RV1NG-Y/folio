import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  Folder,
  FolderInput,
  FolderPlus,
  Grid2X2,
  HardDrive,
  Keyboard,
  Layers2,
  LayoutList,
  Library,
  Link2,
  LoaderCircle,
  Minus,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  Settings2,
  Square,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  COLORS,
  createLibrary,
  descendants,
  domain,
  moveItem,
  normalizeUrl,
  validateLibrary,
} from "./model.mjs";

const STORE = "folio-library-v1";
const PREFS = "folio-preferences-v1";
const desktop = window.folio;
const specialViews = ["all", "favorites", "recent", "unfiled"];
const viewNames = {
  all: "All bookmarks",
  favorites: "Favorites",
  recent: "Recently added",
  unfiled: "Unfiled",
};
const viewIcons = {
  all: Library,
  favorites: Star,
  recent: Clock3,
  unfiled: Bookmark,
};
const readPrefs = () => {
  try {
    return JSON.parse(localStorage.getItem(PREFS)) || {};
  } catch {
    return {};
  }
};

function IconButton({ icon: Icon, label, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={16} strokeWidth={1.6} />
    </button>
  );
}

function FolderIcon({ color, size = 18, ...props }) {
  return (
    <Folder
      size={size}
      strokeWidth={1.5}
      style={{
        color: COLORS[color] || undefined,
        fill: color ? `${COLORS[color]}15` : undefined,
      }}
      {...props}
    />
  );
}

function Favicon({ bookmark }) {
  const [failed, setFailed] = useState(false);
  const [resolved, setResolved] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const host = domain(bookmark.url);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResolved(null);
    setLoaded(false);
    if (desktop)
      desktop
        .favicon(bookmark.url)
        .then((icon) => {
          if (!cancelled) {
            setResolved(icon);
            setFailed(!icon);
          }
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    return () => {
      cancelled = true;
    };
  }, [bookmark.url]);
  const hue = [...host].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
  return (
    <div className="favicon" style={{ "--icon-hue": hue }}>
      <span aria-hidden="true">{bookmark.title.slice(0, 1).toUpperCase()}</span>
      {!failed && (!desktop || resolved) && (
        <img
          src={resolved || `${new URL(bookmark.url).origin}/favicon.ico`}
          alt=""
          width="32"
          height="32"
          loading="lazy"
          style={{ opacity: loaded ? 1 : 0 }}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const previous = document.activeElement;
    const element = ref.current;
    element.showModal();
    element.querySelector("[data-autofocus]")?.focus();
    return () => {
      element.close();
      previous?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <IconButton icon={X} label="Close dialog" onClick={onClose} />
      </div>
      {children}
    </dialog>
  );
}

function ContextMenu({ menu, close, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8))}px`;
    el.querySelector("button")?.focus();
    const outside = (e) => {
      if (!el.contains(e.target)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menu]);
  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left: menu.x, top: menu.y }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
        if (["ArrowDown", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          const buttons = [
            ...ref.current.querySelectorAll("button:not(:disabled)"),
          ];
          const index = buttons.indexOf(document.activeElement);
          buttons[
            (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length
          ]?.focus();
        }
      }}
    >
      {children}
    </div>
  );
}

function MenuItem({ icon: Icon, children, danger, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-item ${danger ? "danger" : ""}`}
      {...props}
    >
      {Icon && <Icon size={15} strokeWidth={1.6} />}
      <span>{children}</span>
    </button>
  );
}

function TreeFolder({ folder, depth = 0, tree }) {
  const {
    folders,
    expanded,
    effectiveView,
    searching,
    dragTarget,
    showMenu,
    dragProps,
    dropProps,
    setExpanded,
    navigate,
    countInFolder,
  } = tree;
  const children = folders.filter((f) => f.parentId === folder.id);
  const isExpanded = expanded.has(folder.id);
  return (
    <div className="tree-branch">
      <div
        className={`tree-row ${effectiveView === folder.id && !searching ? "active" : ""} ${dragTarget === folder.id ? "drop-target" : ""}`}
        style={{ "--depth": depth }}
        onContextMenu={(e) => showMenu(e, "folder", folder)}
        {...dragProps("folder", folder.id)}
        {...dropProps(folder.id)}
      >
        <button
          className={`tree-chevron ${children.length ? "" : "no-children"}`}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
          disabled={!children.length}
          onClick={() =>
            setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(folder.id)) next.delete(folder.id);
              else next.add(folder.id);
              return next;
            })
          }
        >
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button
          className="tree-folder"
          draggable
          onClick={() => navigate(folder.id)}
          aria-current={
            effectiveView === folder.id && !searching ? "page" : undefined
          }
        >
          <FolderIcon color={folder.color} size={17} />
          <span>{folder.name}</span>
          <span className="tree-count">{countInFolder(folder.id) || ""}</span>
        </button>
        <IconButton
          icon={Ellipsis}
          label={`Options for ${folder.name}`}
          className="tree-more"
          onClick={(e) => showMenu(e, "folder", folder)}
        />
      </div>
      {isExpanded &&
        children.map((child) => (
          <TreeFolder
            key={child.id}
            folder={child}
            depth={depth + 1}
            tree={tree}
          />
        ))}
    </div>
  );
}

export default function App() {
  const [library, setLibrary] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [selected, setSelected] = useState(
    () => readPrefs().selected || "design",
  );
  const [expanded, setExpanded] = useState(
    () => new Set(readPrefs().expanded || ["design"]),
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState(() => readPrefs().layout || "grid");
  const [sort, setSort] = useState(() => readPrefs().sort || "newest");
  const [menu, setMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const [history, setHistory] = useState({ items: [selected], index: 0 });
  const searchRef = useRef(null);
  const importRef = useRef(null);
  const saveVersion = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const saved = desktop
          ? await desktop.load()
          : JSON.parse(localStorage.getItem(STORE) || "null");
        setLibrary(saved ? validateLibrary(saved) : createLibrary());
      } catch (error) {
        setLoadError(error.message || "Your library could not be opened.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!library) return;
    const version = ++saveVersion.current;
    setSaveState("saving");
    (async () => {
      try {
        if (desktop) await desktop.save(library);
        else localStorage.setItem(STORE, JSON.stringify(library));
        if (version === saveVersion.current) setSaveState("saved");
      } catch {
        if (version === saveVersion.current) setSaveState("error");
      }
    })();
  }, [library]);

  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS,
        JSON.stringify({ selected, expanded: [...expanded], layout, sort }),
      );
    } catch {
      /* Library save errors are reported separately. */
    }
  }, [selected, expanded, layout, sort]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.undo ? 8000 : 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const folders = library?.folders || [];
  const bookmarks = library?.bookmarks || [];
  const currentFolder = folders.find((f) => f.id === selected);
  const currentId = currentFolder?.id || null;
  const effectiveView = currentFolder
    ? selected
    : specialViews.includes(selected)
      ? selected
      : "all";
  const searching = Boolean(query.trim());
  const matches = (text) =>
    text.toLowerCase().includes(query.trim().toLowerCase());
  const visibleFolders = folders
    .filter((f) =>
      searching
        ? matches(f.name)
        : effectiveView === "all"
          ? f.parentId === null
          : currentFolder
            ? f.parentId === currentId
            : false,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const visibleBookmarks = bookmarks
    .filter((b) =>
      searching
        ? matches(`${b.title} ${b.url} ${b.description}`)
        : effectiveView === "favorites"
          ? b.favorite
          : effectiveView === "unfiled"
            ? b.folderId === null
            : currentFolder
              ? b.folderId === currentId
              : true,
    )
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.createdAt - b.createdAt
          : b.createdAt - a.createdAt,
    );
  const title = searching
    ? "Search results"
    : currentFolder?.name || viewNames[effectiveView];
  const MainIcon = searching ? Search : viewIcons[effectiveView] || Folder;
  const breadcrumbs = [];
  let ancestor = currentFolder;
  while (ancestor) {
    breadcrumbs.unshift(ancestor);
    ancestor = folders.find((f) => f.id === ancestor.parentId);
  }
  const countInFolder = (id) =>
    bookmarks.filter((b) => descendants(folders, id).has(b.folderId)).length;
  const folderPath = (id) => {
    if (!id) return "Unfiled";
    const parts = [];
    let f = folders.find((item) => item.id === id);
    while (f) {
      parts.unshift(f.name);
      f = folders.find((item) => item.id === f.parentId);
    }
    return parts.join(" / ");
  };
  const folderOptions = folders
    .slice()
    .sort((a, b) => folderPath(a.id).localeCompare(folderPath(b.id)));

  function notify(message, undo) {
    setToast({ message, undo });
  }
  function change(next, message, undoable = false) {
    const previous = library;
    setLibrary(typeof next === "function" ? next(library) : next);
    if (message)
      notify(
        message,
        undoable && previous
          ? () => {
              setLibrary(previous);
              setToast(null);
            }
          : undefined,
      );
    else setToast(null);
  }
  function navigate(id) {
    setQuery("");
    setMenu(null);
    setSelected(id);
    setHistory((h) =>
      h.items[h.index] === id
        ? h
        : { items: [...h.items.slice(0, h.index + 1), id], index: h.index + 1 },
    );
    const parents = new Set(expanded);
    let f = folders.find((item) => item.id === id);
    while (f) {
      parents.add(f.id);
      f = folders.find((item) => item.id === f.parentId);
    }
    setExpanded(parents);
  }
  function travel(delta) {
    const index = history.index + delta;
    if (index < 0 || index >= history.items.length) return;
    setQuery("");
    setSelected(history.items[index]);
    setHistory({ ...history, index });
  }
  function showMenu(event, type, item) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({
      type,
      item,
      x: event.type === "contextmenu" ? event.clientX : rect.right - 220,
      y: event.type === "contextmenu" ? event.clientY : rect.bottom + 6,
    });
  }
  function newBookmark() {
    setMenu(null);
    setModal({ type: "bookmark", folderId: currentId });
  }
  function newFolder(parentId = currentId) {
    setMenu(null);
    setModal({ type: "folder", parentId });
  }
  function favorite(bookmark) {
    change({
      ...library,
      bookmarks: bookmarks.map((b) =>
        b.id === bookmark.id ? { ...b, favorite: !b.favorite } : b,
      ),
    });
  }
  async function openBookmark(bookmark) {
    try {
      const url = normalizeUrl(bookmark.url);
      if (desktop) await desktop.open(url);
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify(error.message);
    }
  }
  async function copyLink(bookmark) {
    try {
      await navigator.clipboard.writeText(bookmark.url);
      notify("Link copied to clipboard");
    } catch {
      notify("Could not copy the link. You can copy it from Edit bookmark.");
    }
    setMenu(null);
  }
  function drop(event, id) {
    event.preventDefault();
    event.stopPropagation();
    setDragTarget(null);
    try {
      const item = JSON.parse(
        event.dataTransfer.getData("application/x-folio"),
      );
      change(
        moveItem(library, item.kind, item.id, id),
        `Moved to ${id ? folderPath(id) : "Unfiled"}`,
        true,
      );
    } catch (error) {
      if (event.dataTransfer.types.includes("application/x-folio"))
        notify(error.message);
    }
  }
  function dragProps(kind, id) {
    return {
      draggable: true,
      onDragStart: (event) => {
        event.dataTransfer.setData(
          "application/x-folio",
          JSON.stringify({ kind, id }),
        );
        event.dataTransfer.effectAllowed = "move";
      },
      onDragEnd: () => setDragTarget(null),
    };
  }
  function dropProps(id) {
    return {
      onDragOver: (event) => {
        if (event.dataTransfer.types.includes("application/x-folio")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragTarget(id ?? "unfiled");
        }
      },
      onDragLeave: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setDragTarget(null);
      },
      onDrop: (event) => drop(event, id),
    };
  }
  async function exportLibrary() {
    setMenu(null);
    try {
      if (desktop) {
        if (await desktop.export(library)) notify("Library exported");
      } else {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(library, null, 2)], {
            type: "application/json",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `Folio-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify("Library exported");
      }
    } catch (error) {
      notify(`Export failed: ${error.message}`);
    }
  }
  async function importLibrary() {
    setMenu(null);
    try {
      if (desktop) {
        const data = await desktop.import();
        if (data) setModal({ type: "import", data });
      } else importRef.current.click();
    } catch (error) {
      notify(`Import failed: ${error.message}`);
    }
  }

  useEffect(() => {
    function keydown(e) {
      if (e.key === "Escape") {
        setMenu(null);
        if (query) setQuery("");
      }
      if (modal || !library) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (e.shiftKey) newFolder();
        else newBookmark();
      }
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        travel(-1);
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        travel(1);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  if (!library && !loadError)
    return (
      <div className="loading">
        <img src="./folio.svg" alt="Folio" width="44" />
        <LoaderCircle className="spin" size={20} />
      </div>
    );

  return (
    <div
      className={`app ${sidebarOpen ? "" : "sidebar-collapsed"} ${desktop?.platform === "darwin" ? "mac" : ""}`}
    >
      <aside className="sidebar" aria-label="Library navigation">
        <div className="brand drag-region">
          <img src="./folio.svg" alt="" />
          <span>
            folio<span className="brand-period">.</span>
          </span>
          <IconButton
            icon={PanelLeft}
            label="Hide sidebar"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
        <div className="sidebar-content">
          <div className="workspace-label">
            <span>YOUR LIBRARY</span>
            <span className="local-pill">Local</span>
          </div>
          <nav className="quick-nav">
            {[
              ["all", Library],
              ["favorites", Star],
              ["recent", Clock3],
            ].map(([id, Icon]) => (
              <button
                key={id}
                className={`nav-item ${effectiveView === id && !searching ? "active" : ""}`}
                onClick={() => navigate(id)}
              >
                <Icon size={17} strokeWidth={1.6} />
                <span>{viewNames[id]}</span>
                {id === "all" && (
                  <span className="nav-count">{bookmarks.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="section-label">
            <span>FOLDERS</span>
            <IconButton
              icon={FolderPlus}
              label="New root folder"
              onClick={() => newFolder(null)}
              disabled={!library}
            />
          </div>
          <nav className="folder-tree" aria-label="Folders">
            {folders
              .filter((f) => f.parentId === null)
              .map((folder) => (
                <TreeFolder
                  key={folder.id}
                  folder={folder}
                  tree={{
                    folders,
                    expanded,
                    effectiveView,
                    searching,
                    dragTarget,
                    showMenu,
                    dragProps,
                    dropProps,
                    setExpanded,
                    navigate,
                    countInFolder,
                  }}
                />
              ))}
          </nav>
          <button
            className="new-folder-inline"
            onClick={() => newFolder(null)}
            disabled={!library}
          >
            <Plus size={15} />
            <span>New folder</span>
          </button>
          <div className="sidebar-divider" />
          <button
            className={`nav-item unfiled ${effectiveView === "unfiled" && !searching ? "active" : ""} ${dragTarget === "unfiled" ? "drop-target" : ""}`}
            onClick={() => navigate("unfiled")}
            {...dropProps(null)}
          >
            <Bookmark size={17} strokeWidth={1.6} />
            <span>Unfiled</span>
            <span className="nav-count">
              {bookmarks.filter((b) => !b.folderId).length || ""}
            </span>
          </button>
        </div>
        <div className="sidebar-footer">
          <div className="library-device">
            <div className="device-icon">
              <HardDrive size={17} />
            </div>
            <div>
              <strong>My library</strong>
              <span>Just for you. On this device.</span>
            </div>
          </div>
          <IconButton
            icon={Settings2}
            label="Library settings"
            onClick={(e) => showMenu(e, "settings")}
          />
        </div>
      </aside>

      <main className="main">
        <header
          className="toolbar drag-region"
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget) desktop?.maximize();
          }}
        >
          {!sidebarOpen && (
            <IconButton
              icon={PanelLeft}
              label="Show sidebar"
              onClick={() => setSidebarOpen(true)}
            />
          )}
          <div className="history-buttons">
            <IconButton
              icon={ArrowLeft}
              label="Go back"
              disabled={history.index === 0}
              onClick={() => travel(-1)}
            />
            <IconButton
              icon={ArrowRight}
              label="Go forward"
              disabled={history.index === history.items.length - 1}
              onClick={() => travel(1)}
            />
          </div>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <button onClick={() => navigate("all")}>Library</button>
            {!searching &&
              breadcrumbs.map((f) => (
                <React.Fragment key={f.id}>
                  <ChevronRight size={12} />
                  <button
                    onClick={() => navigate(f.id)}
                    className={f.id === currentId ? "current" : ""}
                  >
                    {f.name}
                  </button>
                </React.Fragment>
              ))}
            {searching && (
              <>
                <ChevronRight size={12} />
                <span>Search</span>
              </>
            )}
          </nav>
          <div className="toolbar-spacer" />
          <label className="search">
            <Search size={15} strokeWidth={1.6} />
            <input
              ref={searchRef}
              aria-label="Search bookmarks"
              placeholder="Search anything..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <IconButton
                icon={X}
                label="Clear search"
                onClick={() => setQuery("")}
              />
            ) : (
              <kbd>{desktop?.platform === "darwin" ? "⌘" : "Ctrl"} K</kbd>
            )}
          </label>
          {desktop && desktop.platform !== "darwin" && (
            <div className="window-controls">
              <IconButton
                icon={Minus}
                label="Minimize window"
                onClick={() => desktop.minimize()}
              />
              <IconButton
                icon={Square}
                label="Maximize or restore window"
                onClick={() => desktop.maximize()}
              />
              <IconButton
                icon={X}
                label="Close window"
                className="window-close"
                onClick={() => desktop.close()}
              />
            </div>
          )}
        </header>

        {loadError ? (
          <div className="empty-state error-state">
            <Library size={32} />
            <h2>Let’s recover your library</h2>
            <p>{loadError}</p>
            <button className="primary-button" onClick={importLibrary}>
              <Upload size={16} />
              Restore a backup
            </button>
          </div>
        ) : (
          <>
            {saveState === "error" && (
              <div className="save-error" role="alert">
                Changes couldn’t be saved. Keep this window open and export a
                backup.<button onClick={exportLibrary}>Export library</button>
                <button onClick={() => setLibrary({ ...library })}>
                  Retry
                </button>
              </div>
            )}
            <div
              className="content-scroll"
              onClick={() => menu && setMenu(null)}
            >
              <div className="content">
                <section className="page-heading">
                  <div className="heading-copy">
                    <div className="eyebrow">
                      {searching
                        ? "FIND SOMETHING GOOD"
                        : effectiveView === "favorites"
                          ? "THE KEEPERS"
                          : effectiveView === "recent"
                            ? "FRESHLY COLLECTED"
                            : "A PLACE FOR GOOD FINDS"}
                    </div>
                    <div className="heading-title">
                      <MainIcon
                        size={27}
                        strokeWidth={1.35}
                        style={{
                          color: COLORS[currentFolder?.color] || undefined,
                        }}
                      />
                      <h1>{title}</h1>
                      {currentFolder && !searching && (
                        <IconButton
                          icon={Ellipsis}
                          label="Folder options"
                          onClick={(e) => showMenu(e, "folder", currentFolder)}
                        />
                      )}
                    </div>
                    <p>
                      {searching
                        ? `Matches for “${query.trim()}” across your library`
                        : `${visibleBookmarks.length} bookmark${visibleBookmarks.length !== 1 ? "s" : ""}${visibleFolders.length ? ` · ${visibleFolders.length} folder${visibleFolders.length !== 1 ? "s" : ""}` : ""}`}
                      <span className="heading-separator">/</span>
                      <span>
                        {searching
                          ? `${visibleBookmarks.length + visibleFolders.length} results`
                          : "Room for your next discovery."}
                      </span>
                    </p>
                  </div>
                  <button className="primary-button" onClick={newBookmark}>
                    <Plus size={17} strokeWidth={1.8} />
                    Add bookmark
                  </button>
                </section>

                {visibleFolders.length > 0 && (
                  <section className="folders-section" aria-label="Subfolders">
                    <div className="section-heading">
                      <h2>
                        Folders<span>{visibleFolders.length}</span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => newFolder()}
                      >
                        <Plus size={13} />
                        New folder
                      </button>
                    </div>
                    <div className="folder-grid">
                      {visibleFolders.map((folder) => (
                        <div
                          key={folder.id}
                          className={`folder-card ${dragTarget === folder.id ? "drop-target" : ""}`}
                          {...dragProps("folder", folder.id)}
                          {...dropProps(folder.id)}
                          onContextMenu={(e) => showMenu(e, "folder", folder)}
                        >
                          <button
                            className="folder-card-open"
                            draggable
                            onClick={() => navigate(folder.id)}
                          >
                            <div className="folder-card-icon">
                              <FolderIcon color={folder.color} size={26} />
                            </div>
                            <div>
                              <strong>{folder.name}</strong>
                              <span>
                                {countInFolder(folder.id)} bookmark
                                {countInFolder(folder.id) !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <ChevronRight className="folder-enter" size={15} />
                          </button>
                          <IconButton
                            icon={Ellipsis}
                            label={`Card options for ${folder.name}`}
                            className="folder-card-menu"
                            onClick={(e) => showMenu(e, "folder", folder)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="bookmarks-section" aria-label="Bookmarks">
                  <div className="section-heading bookmarks-heading">
                    <h2>
                      {searching
                        ? "Bookmarks"
                        : effectiveView === "recent"
                          ? "Latest bookmarks"
                          : "Bookmarks"}
                      <span>{visibleBookmarks.length}</span>
                    </h2>
                    <div className="view-tools">
                      <button
                        className="sort-button"
                        onClick={(e) => showMenu(e, "sort")}
                      >
                        <ArrowDownWideNarrow size={14} />
                        <span>
                          {sort === "name"
                            ? "Name"
                            : sort === "oldest"
                              ? "Oldest first"
                              : "Newest first"}
                        </span>
                        <ChevronDown size={12} />
                      </button>
                      <div
                        className="layout-switch"
                        aria-label="Bookmark layout"
                      >
                        <IconButton
                          icon={Grid2X2}
                          label="Grid view"
                          className={layout === "grid" ? "selected" : ""}
                          aria-pressed={layout === "grid"}
                          onClick={() => setLayout("grid")}
                        />
                        <IconButton
                          icon={LayoutList}
                          label="List view"
                          className={layout === "list" ? "selected" : ""}
                          aria-pressed={layout === "list"}
                          onClick={() => setLayout("list")}
                        />
                      </div>
                    </div>
                  </div>
                  {visibleBookmarks.length ? (
                    <div
                      className={`bookmark-grid ${layout === "list" ? "list-view" : ""}`}
                    >
                      {visibleBookmarks.map((bookmark) => (
                        <article
                          key={bookmark.id}
                          className="bookmark-card"
                          {...dragProps("bookmark", bookmark.id)}
                          onContextMenu={(e) =>
                            showMenu(e, "bookmark", bookmark)
                          }
                        >
                          <button
                            className="bookmark-open"
                            draggable
                            aria-label={`Open ${bookmark.title}`}
                            onClick={() => openBookmark(bookmark)}
                          >
                            <Favicon bookmark={bookmark} />
                            <div className="bookmark-copy">
                              <h3>{bookmark.title}</h3>
                              <p>
                                {bookmark.description ||
                                  "A good find, saved for later."}
                              </p>
                            </div>
                            <div className="bookmark-bottom">
                              <span>{domain(bookmark.url)}</span>
                              <ArrowUpRight size={14} />
                            </div>
                          </button>
                          <div className="card-actions">
                            <IconButton
                              icon={Star}
                              label={`${bookmark.favorite ? "Unfavorite" : "Favorite"} ${bookmark.title}`}
                              className={`favorite-button ${bookmark.favorite ? "is-favorite" : ""}`}
                              onClick={() => favorite(bookmark)}
                            />
                            <IconButton
                              icon={Ellipsis}
                              label={`Options for ${bookmark.title}`}
                              onClick={(e) => showMenu(e, "bookmark", bookmark)}
                            />
                          </div>
                          {(searching ||
                            specialViews.includes(effectiveView)) && (
                            <button
                              className="bookmark-location"
                              onClick={() =>
                                navigate(bookmark.folderId || "unfiled")
                              }
                              title={folderPath(bookmark.folderId)}
                            >
                              <Folder size={11} />
                              {folderPath(bookmark.folderId)}
                            </button>
                          )}
                        </article>
                      ))}
                      {!searching && layout === "grid" && (
                        <button className="add-card" onClick={newBookmark}>
                          <span className="add-card-icon">
                            <Plus size={20} strokeWidth={1.4} />
                          </span>
                          <strong>Your next good find</strong>
                          <span>Add a bookmark</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">
                        {searching ? (
                          <Search size={26} strokeWidth={1.4} />
                        ) : (
                          <Bookmark size={26} strokeWidth={1.4} />
                        )}
                      </div>
                      <h3>
                        {searching
                          ? "Nothing here just yet"
                          : effectiveView === "favorites"
                            ? "Keep your favorites close"
                            : "Good finds start here"}
                      </h3>
                      <p>
                        {searching
                          ? "Try another title, web address, or keyword."
                          : effectiveView === "favorites"
                            ? "Star a bookmark to make it easy to come back to."
                            : "Save a link you’d like to come back to."}
                      </p>
                      {!searching && effectiveView !== "favorites" && (
                        <button
                          className="secondary-button"
                          onClick={newBookmark}
                        >
                          <Plus size={15} />
                          Add your first bookmark
                        </button>
                      )}
                    </div>
                  )}
                </section>
                {visibleBookmarks.length > 0 && (
                  <div className="content-note">
                    <span />A little less searching. A little more finding.
                    <span />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        <footer className="statusbar">
          <span>
            {searching
              ? `${visibleBookmarks.length + visibleFolders.length} results`
              : `${bookmarks.length} bookmarks in your library`}
          </span>
          <div>
            <span className={`save-indicator ${saveState}`} />
            <span aria-live="polite">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "error"
                  ? "Not saved"
                  : "Saved on this device"}
            </span>
            <IconButton
              icon={Keyboard}
              label="Keyboard shortcuts"
              onClick={() => setModal({ type: "shortcuts" })}
            />
          </div>
        </footer>
      </main>

      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          try {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 25 * 1024 * 1024)
              throw new Error("Backup files must be smaller than 25 MB.");
            setModal({
              type: "import",
              data: validateLibrary(JSON.parse(await file.text())),
            });
          } catch (error) {
            notify(`Import failed: ${error.message}`);
          } finally {
            e.target.value = "";
          }
        }}
      />

      {menu && (
        <ContextMenu menu={menu} close={() => setMenu(null)}>
          {menu.type === "folder" && (
            <>
              <div className="menu-caption">{menu.item.name}</div>
              <MenuItem
                icon={FolderPlus}
                onClick={() => newFolder(menu.item.id)}
              >
                New subfolder
              </MenuItem>
              <MenuItem
                icon={Pencil}
                onClick={() => {
                  setModal({ type: "folder", item: menu.item });
                  setMenu(null);
                }}
              >
                Rename folder
              </MenuItem>
              <MenuItem
                icon={FolderInput}
                onClick={() => {
                  setModal({ type: "move", kind: "folder", item: menu.item });
                  setMenu(null);
                }}
              >
                Move to…
              </MenuItem>
              <div className="menu-divider" />
              <div className="menu-caption">Folder color</div>
              <div className="color-options">
                <button
                  role="menuitem"
                  aria-label="No folder color"
                  title="No color"
                  className={!menu.item.color ? "chosen" : ""}
                  onClick={() => {
                    change({
                      ...library,
                      folders: folders.map((f) =>
                        f.id === menu.item.id ? { ...f, color: null } : f,
                      ),
                    });
                    setMenu(null);
                  }}
                >
                  <span className="no-color">
                    <Minus size={14} />
                  </span>
                </button>
                {Object.entries(COLORS).map(([name, color]) => (
                  <button
                    key={name}
                    role="menuitem"
                    aria-label={`${name} folder color`}
                    title={name}
                    className={menu.item.color === name ? "chosen" : ""}
                    onClick={() => {
                      change({
                        ...library,
                        folders: folders.map((f) =>
                          f.id === menu.item.id ? { ...f, color: name } : f,
                        ),
                      });
                      setMenu(null);
                    }}
                  >
                    <span style={{ background: color }}>
                      {menu.item.color === name && <Check size={11} />}
                    </span>
                  </button>
                ))}
              </div>
              <div className="menu-divider" />
              <MenuItem
                icon={Trash2}
                danger
                onClick={() => {
                  setModal({ type: "delete-folder", item: menu.item });
                  setMenu(null);
                }}
              >
                Delete folder
              </MenuItem>
            </>
          )}
          {menu.type === "bookmark" && (
            <>
              <MenuItem
                icon={ExternalLink}
                onClick={() => {
                  openBookmark(menu.item);
                  setMenu(null);
                }}
              >
                Open in browser
              </MenuItem>
              <MenuItem
                icon={Pencil}
                onClick={() => {
                  setModal({ type: "bookmark", item: menu.item });
                  setMenu(null);
                }}
              >
                Edit bookmark
              </MenuItem>
              <MenuItem
                icon={Star}
                onClick={() => {
                  favorite(menu.item);
                  setMenu(null);
                }}
              >
                {menu.item.favorite
                  ? "Remove from favorites"
                  : "Add to favorites"}
              </MenuItem>
              <MenuItem
                icon={FolderInput}
                onClick={() => {
                  setModal({ type: "move", kind: "bookmark", item: menu.item });
                  setMenu(null);
                }}
              >
                Move to…
              </MenuItem>
              <MenuItem icon={Copy} onClick={() => copyLink(menu.item)}>
                Copy link
              </MenuItem>
              <div className="menu-divider" />
              <MenuItem
                icon={Trash2}
                danger
                onClick={() => {
                  change(
                    {
                      ...library,
                      bookmarks: bookmarks.filter((b) => b.id !== menu.item.id),
                    },
                    "Bookmark deleted",
                    true,
                  );
                  setMenu(null);
                }}
              >
                Delete bookmark
              </MenuItem>
            </>
          )}
          {menu.type === "sort" &&
            [
              ["newest", "Newest first", Clock3],
              ["oldest", "Oldest first", Clock3],
              ["name", "Name, A to Z", ArrowDownAZ],
            ].map(([value, name, Icon]) => (
              <MenuItem
                key={value}
                icon={Icon}
                onClick={() => {
                  setSort(value);
                  setMenu(null);
                }}
              >
                {name}
                {sort === value && <Check size={14} className="menu-check" />}
              </MenuItem>
            ))}
          {menu.type === "settings" && (
            <>
              <div className="menu-caption">Your library</div>
              <MenuItem
                icon={Download}
                disabled={!library}
                onClick={exportLibrary}
              >
                Export backup
              </MenuItem>
              <MenuItem icon={Upload} onClick={importLibrary}>
                Import backup…
              </MenuItem>
              <div className="menu-divider" />
              <MenuItem
                icon={Keyboard}
                onClick={() => {
                  setModal({ type: "shortcuts" });
                  setMenu(null);
                }}
              >
                Keyboard shortcuts
              </MenuItem>
              <MenuItem
                icon={Trash2}
                disabled={!library}
                onClick={() => {
                  setModal({ type: "clear" });
                  setMenu(null);
                }}
              >
                Start with an empty library…
              </MenuItem>
              <div className="menu-footnote">
                Folio 1.0 · Made for your good finds.
              </div>
            </>
          )}
        </ContextMenu>
      )}

      {modal?.type === "bookmark" && (
        <BookmarkModal
          modal={modal}
          folders={folderOptions}
          folderPath={folderPath}
          onClose={() => setModal(null)}
          onSave={(values) => {
            if (
              bookmarks.some(
                (b) =>
                  b.id !== modal.item?.id &&
                  b.folderId === values.folderId &&
                  normalizeUrl(b.url) === values.url,
              )
            )
              throw new Error("This link is already saved in that folder.");
            const bookmark = {
              ...values,
              id: modal.item?.id || crypto.randomUUID(),
              createdAt: modal.item?.createdAt || Date.now(),
              favorite: modal.item?.favorite || false,
            };
            change(
              {
                ...library,
                bookmarks: modal.item
                  ? bookmarks.map((b) => (b.id === bookmark.id ? bookmark : b))
                  : [...bookmarks, bookmark],
              },
              modal.item ? "Bookmark updated" : "Bookmark saved",
            );
            setModal(null);
          }}
        />
      )}
      {modal?.type === "folder" && (
        <FolderModal
          modal={modal}
          parentName={folderPath(modal.parentId)}
          onClose={() => setModal(null)}
          onSave={(name) => {
            const parentId = modal.item ? modal.item.parentId : modal.parentId;
            if (
              folders.some(
                (f) =>
                  f.id !== modal.item?.id &&
                  f.parentId === parentId &&
                  f.name.toLowerCase() === name.toLowerCase(),
              )
            )
              throw new Error("A folder with that name already exists here.");
            const folder = modal.item
              ? { ...modal.item, name }
              : { id: crypto.randomUUID(), name, parentId, color: null };
            change(
              {
                ...library,
                folders: modal.item
                  ? folders.map((f) => (f.id === folder.id ? folder : f))
                  : [...folders, folder],
              },
              modal.item ? "Folder renamed" : "Folder created",
            );
            if (parentId) setExpanded(new Set([...expanded, parentId]));
            setModal(null);
          }}
        />
      )}
      {modal?.type === "move" && (
        <MoveModal
          modal={modal}
          folders={folderOptions.filter(
            (f) =>
              modal.kind !== "folder" ||
              !descendants(folders, modal.item.id).has(f.id),
          )}
          folderPath={folderPath}
          onClose={() => setModal(null)}
          onSave={(destination) => {
            try {
              change(
                moveItem(library, modal.kind, modal.item.id, destination),
                "Moved successfully",
                true,
              );
              setModal(null);
            } catch (error) {
              notify(error.message);
            }
          }}
        />
      )}
      {modal?.type === "delete-folder" && (
        <Modal
          title={`Delete “${modal.item.name}”?`}
          onClose={() => setModal(null)}
        >
          <p className="modal-description">
            This removes the folder, its subfolders, and{" "}
            {countInFolder(modal.item.id)} bookmark
            {countInFolder(modal.item.id) !== 1 ? "s" : ""}. You can undo this
            immediately afterward.
          </p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              data-autofocus
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button
              className="danger-button"
              onClick={() => {
                const ids = descendants(folders, modal.item.id);
                change(
                  {
                    ...library,
                    folders: folders.filter((f) => !ids.has(f.id)),
                    bookmarks: bookmarks.filter((b) => !ids.has(b.folderId)),
                  },
                  "Folder deleted",
                  true,
                );
                if (ids.has(selected)) navigate(modal.item.parentId || "all");
                setModal(null);
              }}
            >
              Delete folder
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "import" && (
        <Modal title="Import this library?" onClose={() => setModal(null)}>
          <p className="modal-description">
            Replace your current library with {modal.data.bookmarks.length}{" "}
            bookmarks and {modal.data.folders.length} folders from this backup.
            You can undo this immediately afterward.
          </p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              data-autofocus
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={() => {
                change(modal.data, "Library imported", true);
                setLoadError("");
                navigate("all");
                setModal(null);
              }}
            >
              Import library
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "clear" && (
        <Modal title="A fresh start?" onClose={() => setModal(null)}>
          <p className="modal-description">
            Remove all {bookmarks.length} bookmarks and {folders.length} folders
            from this library. Export a backup first if you’d like to keep them.
          </p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              data-autofocus
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button
              className="danger-button"
              onClick={() => {
                change(
                  { version: 1, folders: [], bookmarks: [] },
                  "Library cleared",
                  true,
                );
                navigate("all");
                setModal(null);
              }}
            >
              Clear library
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "shortcuts" && (
        <Modal title="A few handy shortcuts" onClose={() => setModal(null)}>
          <div className="shortcuts">
            {[
              ["Search your library", "Ctrl / ⌘ K"],
              ["Add a bookmark", "Ctrl / ⌘ N"],
              ["Create a folder", "Ctrl / ⌘ Shift N"],
              ["Go back / forward", "Alt ← / →"],
              ["Close a dialog or clear search", "Esc"],
            ].map(([label, keys]) => (
              <div key={label}>
                <span>{label}</span>
                <kbd>{keys}</kbd>
              </div>
            ))}
          </div>
          <p className="shortcut-tip">
            Drag bookmarks and folders onto a folder to organize them.
            Right-click any item for more options.
          </p>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          <span>{toast.message}</span>
          {toast.undo && <button onClick={toast.undo}>Undo</button>}
          <IconButton
            icon={X}
            label="Dismiss notification"
            onClick={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}

function BookmarkModal({ modal, folders, folderPath, onClose, onSave }) {
  const [error, setError] = useState("");
  return (
    <Modal
      title={modal.item ? "Edit bookmark" : "Save a good find"}
      onClose={onClose}
    >
      <p className="modal-description">A link worth coming back to.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget);
          try {
            const url = normalizeUrl(values.get("url"));
            onSave({
              url,
              title: values.get("title").trim() || domain(url),
              description: values.get("description").trim(),
              folderId: values.get("folderId") || null,
            });
          } catch (err) {
            setError(
              err.message.includes("Invalid URL")
                ? "Enter a valid web address, like example.com."
                : err.message,
            );
          }
        }}
      >
        <label className="field">
          URL
          <span className="input-with-icon">
            <Link2 size={16} />
            <input
              data-autofocus
              name="url"
              placeholder="https://example.com"
              required
              maxLength={8192}
              defaultValue={modal.item?.url || ""}
              autoComplete="off"
            />
          </span>
        </label>
        <label className="field">
          Title<span className="optional">optional</span>
          <input
            name="title"
            placeholder="Give your bookmark a name"
            maxLength={300}
            defaultValue={modal.item?.title || ""}
          />
        </label>
        <label className="field">
          Description<span className="optional">optional</span>
          <textarea
            name="description"
            placeholder="A little context for later…"
            rows={2}
            maxLength={2000}
            defaultValue={modal.item?.description || ""}
          />
        </label>
        <label className="field">
          Save in
          <select
            name="folderId"
            defaultValue={modal.item?.folderId ?? modal.folderId ?? ""}
          >
            <option value="">Unfiled</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {folderPath(f.id)}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            {modal.item ? "Save changes" : "Save bookmark"}
            <span className="enter-hint">↵</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FolderModal({ modal, parentName, onClose, onSave }) {
  const [error, setError] = useState("");
  return (
    <Modal
      title={modal.item ? "Rename folder" : "A little room to organize"}
      onClose={onClose}
    >
      <p className="modal-description">
        {modal.item
          ? "Give this collection a new name."
          : `Create a folder in ${modal.parentId ? parentName : "your library"}.`}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = new FormData(e.currentTarget).get("name").trim();
          if (!name) return setError("Give your folder a name.");
          try {
            onSave(name);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <label className="field">
          Folder name
          <input
            data-autofocus
            name="name"
            required
            maxLength={150}
            placeholder="e.g. Things to explore"
            defaultValue={modal.item?.name || ""}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            {modal.item ? "Save changes" : "Create folder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MoveModal({ modal, folders, folderPath, onClose, onSave }) {
  return (
    <Modal
      title={`Move “${modal.item.title || modal.item.name}”`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(new FormData(e.currentTarget).get("destination") || null);
        }}
      >
        <label className="field">
          Destination
          <select
            data-autofocus
            name="destination"
            defaultValue={
              modal.kind === "folder"
                ? modal.item.parentId || ""
                : modal.item.folderId || ""
            }
          >
            <option value="">
              {modal.kind === "folder" ? "Library (top level)" : "Unfiled"}
            </option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {folderPath(f.id)}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            Move here
          </button>
        </div>
      </form>
    </Modal>
  );
}
