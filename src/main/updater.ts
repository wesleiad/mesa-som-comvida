import { app } from "electron";
import electronUpdater from "electron-updater";
import type { UpdateStatus } from "@shared/types";

const { autoUpdater } = electronUpdater;

// Procura versão nova no GitHub ao abrir e a cada 30 min, baixa em segundo
// plano e só instala quando o programa for fechado — nunca reinicia sozinho
// no meio do culto. O botão "Reiniciar e atualizar" instala na hora.

let status: UpdateStatus = { state: "idle", current: app.getVersion() };
const set = (patch: Partial<UpdateStatus>) => (status = { ...status, ...patch });

export const getUpdateStatus = () => status;

export function startUpdater(): void {
  if (!app.isPackaged) {
    set({ state: "disabled" });
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => set({ state: "checking", error: undefined }));
  autoUpdater.on("update-not-available", () => set({ state: "idle" }));
  autoUpdater.on("update-available", (info) => set({ state: "downloading", next: info.version, percent: 0 }));
  autoUpdater.on("download-progress", (p) => set({ state: "downloading", percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (info) => set({ state: "ready", next: info.version }));
  autoUpdater.on("error", (err) => {
    console.warn("[update]", err);
    // Sem internet na igreja é normal: tenta de novo no próximo ciclo.
    set({ state: status.state === "ready" ? "ready" : "idle", error: String(err?.message ?? err) });
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 10_000);
  setInterval(check, 30 * 60_000);
}

export function installUpdateNow(): boolean {
  if (status.state !== "ready") return false;
  // silencioso e reabre o programa depois de instalar
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
  return true;
}
