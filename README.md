# Folio

A small desktop home for bookmarks. Charcoal surfaces, a file-explorer folder tree, modest 32 px favicons, and a grid of links and subfolders. The Electron window has no separate operating-system titlebar; drag the integrated top toolbar to move it, double-click its blank area to maximize, or use its window controls.

## Run on Linux

The ready-to-run builds are in `release/`:

- Run `Folio-1.0.0-x86_64.AppImage`. Make it executable first if your file manager requires it: `chmod +x release/Folio-1.0.0-x86_64.AppImage`.
- Alternatively, extract `Folio-1.0.0-x64.tar.gz` and run `folio` inside it. This does not require AppImage/FUSE support.
- An unpacked executable is also available at `release/linux-unpacked/folio`.

No account or server is needed. The app opens with a small starter collection so you can try the organization immediately. To begin empty, open **Library settings → Start with an empty library**.

To install Folio in your GNOME applications menu, run `npm run install:linux` after building the AppImage. This copies it to `~/.local/share/folio/Folio.AppImage`, installs the icon, and registers `folio.desktop` for your user (or uses `XDG_DATA_HOME` when configured). Search for **Folio**, then right-click its icon to pin it to the dash. No administrator access is needed. Run the same command after making a new release to update the installed copy; your bookmarks remain in `~/.config/Folio/`.

This follows GNOME’s [desktop integration guidance](https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html), including matching the launcher identity to the application’s windows.

## Everyday use

- Select a folder in the sidebar or open a folder card in the main pane. The pane shows that folder’s immediate bookmarks and subfolders.
- **Add bookmark** accepts a URL, an optional title and description, and a destination folder. A missing title defaults to the website’s domain.
- **New folder** only asks for a name. To add or remove a color afterward, right-click a folder or open its `…` menu and choose a color.
- Drag bookmarks or folders onto another folder. The `…` menu also has **Move to…**, rename/edit, and delete options. Folder cycles are prevented. Deleting a folder asks for confirmation; deletes and moves offer immediate Undo.
- Search looks across titles, URLs, descriptions, and folder names. Favorites, sorting, and a compact list view are available.
- **Library settings** includes JSON backup export/import. Import validates the file and asks before replacing the library. Browser bookmark HTML import is not included.
- `Ctrl+K` searches; `Ctrl+N` adds a bookmark; `Ctrl+Shift+N` creates a folder; `Alt+←/→` navigates. Use Command instead of Control on macOS.

## Local data

On Linux the library is stored at `~/.config/Folio/library.json` (or the corresponding Electron user-data directory if your platform overrides it). Saves are serialized and atomic, with the preceding version in `library.json.bak`. Read failures preserve the original file. Save failures stay visible and let you retry or export.

Favicons are fetched directly from bookmarked websites and cached locally for 30 days. Folio first tries `/favicon.ico`, then icons declared by the website. A colored initial is shown when an icon cannot be retrieved. Bookmark titles, descriptions, and folders remain local. The app does not use an analytics service, a cloud account, or a third-party favicon proxy.

The browser development preview uses localStorage and direct `/favicon.ico` requests. Its data is separate from the desktop library. The desktop version additionally discovers modern favicon URLs, caches icons, and uses native file dialogs.

## Development

Requires Node.js 22.12 or newer and npm.

```sh
npm install
npx install-electron
npm run desktop:dev
```

Other commands:

```sh
npm run dev       # browser preview at http://127.0.0.1:5173
npm test          # data validation, moving folders, persistence and icon tests
npm start         # build and run the desktop app
npm run package   # Linux AppImage, tarball, and unpacked build
```

Set `FOLIO_DATA_DIR` to an absolute path to use an isolated library for testing. The regular application allows one instance per data directory to prevent conflicting writes.

The renderer is sandboxed with context isolation and no Node access. Its narrow IPC bridge validates the calling window, saved data, and external links. Web addresses allow only HTTP/HTTPS; arbitrary navigation and new windows are blocked in the renderer. See Electron’s official [frameless-window guidance](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles) and [security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

## Verification

Automated tests cover web-address validation, recursive folder moves, invalid backups, rapid concurrent saves, reopening disk data, preserving corrupt files, and favicon discovery/caching. Browser checks cover creating a folder without a color step, applying a color later, saving and moving a bookmark, reload persistence, search, and undo. The actual desktop build is launched against a separate test library to verify startup and disk saves.
