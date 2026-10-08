const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  nativeTheme,
  Menu,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { createStorage } = require("./storage.cjs");
const { createFaviconLoader } = require("./favicons.cjs");

if (process.env.FOLIO_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.FOLIO_DATA_DIR));
app.setName("Folio");
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
let win;
let store;
let quitting = false;
const isDev = process.argv.includes("--dev");
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

if (gotLock)
  app.whenReady().then(async () => {
    const { validateLibrary, normalizeUrl } = await import("../src/model.mjs");
    store = createStorage(app.getPath("userData"), validateLibrary);
    const loadFavicon = createFaviconLoader(
      path.join(app.getPath("userData"), "icons"),
    );
    nativeTheme.themeSource = "dark";
    Menu.setApplicationMenu(null);
    const appFile = path.join(__dirname, "../dist/index.html");
    const trusted = isDev
      ? "http://127.0.0.1:5173/"
      : pathToFileURL(appFile).href;
    const handle = (name, handler) =>
      ipcMain.handle(name, (event, ...args) => {
        if (
          !win ||
          event.sender !== win.webContents ||
          event.senderFrame !== win.webContents.mainFrame ||
          event.senderFrame.url !== trusted
        )
          throw new Error("Untrusted request");
        return handler(...args);
      });
    handle("library:load", () => store.load());
    handle("library:save", (data) => store.save(data));
    handle("link:open", (url) => shell.openExternal(normalizeUrl(url)));
    handle("link:favicon", (url) => loadFavicon(normalizeUrl(url)));
    handle("window:minimize", () => win.minimize());
    handle("window:maximize", () =>
      win.isMaximized() ? win.unmaximize() : win.maximize(),
    );
    handle("window:close", () => win.close());
    handle("library:export", async (data) => {
      const valid = validateLibrary(data);
      const result = await dialog.showSaveDialog(win, {
        title: "Export your library",
        defaultPath: `Folio-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "Folio library", extensions: ["json"] }],
      });
      if (result.canceled) return false;
      await fs.writeFile(result.filePath, JSON.stringify(valid, null, 2), {
        mode: 0o600,
      });
      return true;
    });
    handle("library:import", async () => {
      const result = await dialog.showOpenDialog(win, {
        title: "Import a Folio library",
        properties: ["openFile"],
        filters: [{ name: "Folio library", extensions: ["json"] }],
      });
      if (result.canceled) return null;
      if ((await fs.stat(result.filePaths[0])).size > 25 * 1024 * 1024)
        throw new Error("Backup files must be smaller than 25 MB.");
      return validateLibrary(
        JSON.parse(await fs.readFile(result.filePaths[0], "utf8")),
      );
    });
    function createWindow() {
      win = new BrowserWindow({
        width: 1280,
        height: 840,
        minWidth: 800,
        minHeight: 560,
        frame: false,
        titleBarStyle:
          process.platform === "darwin" ? "hiddenInset" : undefined,
        backgroundColor: "#18191b",
        show: false,
        autoHideMenuBar: true,
        icon: path.join(__dirname, "../build/icon.png"),
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          webSecurity: true,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (event) => event.preventDefault());
      win.webContents.session.setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(false),
      );
      win.webContents.session.setPermissionCheckHandler(() => false);
      win.once("ready-to-show", () => win.show());
      win.on("close", (event) => {
        if (quitting) return;
        event.preventDefault();
        store
          .flush()
          .then(() => {
            quitting = true;
            win.close();
          })
          .catch(async () => {
            const result = await dialog.showMessageBox(win, {
              type: "warning",
              message: "Your latest changes could not be saved.",
              detail:
                "Keep Folio open to export your library, or close without saving.",
              buttons: ["Keep open", "Close without saving"],
              defaultId: 0,
              cancelId: 0,
            });
            if (result.response === 1) {
              quitting = true;
              win.close();
            }
          });
      });
      if (isDev) win.loadURL(trusted);
      else win.loadFile(appFile);
    }
    createWindow();
    app.on("activate", () => {
      if (!BrowserWindow.getAllWindows().length) {
        quitting = false;
        createWindow();
      }
    });
  });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
