const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("folio", {
  platform: process.platform,
  load: () => ipcRenderer.invoke("library:load"),
  save: (data) => ipcRenderer.invoke("library:save", data),
  open: (url) => ipcRenderer.invoke("link:open", url),
  favicon: (url) => ipcRenderer.invoke("link:favicon", url),
  export: (data) => ipcRenderer.invoke("library:export", data),
  import: () => ipcRenderer.invoke("library:import"),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
});
