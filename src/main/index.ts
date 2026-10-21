import { app, dialog, shell, BrowserWindow } from "electron";
import { join } from "path";
import { SERVER_PORT } from "@shared/constants";
import { discoverMixers } from "./discovery";
import { startServer } from "./server";
import { getUpdateStatus, installUpdateNow, startUpdater } from "./updater";
import icon from "../../resources/icon.png?asset";

const APP_TITLE = "Mesa de Som - Com.Vida";

// Rodando fora do instalador (dev/testes automatizados): pasta de dados
// própria, senão um teste sobrescreve a configuração REAL do app instalado.
if (!app.isPackaged) {
  app.setPath("userData", `${app.getPath("userData")}-dev`);
}

// Testes automáticos podem usar outra porta pra rodar com o programa instalado aberto.
const port = (!app.isPackaged && Number(process.env["MESA_PORT"])) || SERVER_PORT;
const devUrl = (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) || undefined;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 420,
    minHeight: 560,
    title: APP_TITLE,
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
    show: false,
    icon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Os medidores (VU) continuam andando com a janela minimizada.
      backgroundThrottling: false,
    },
  });

  win.on("ready-to-show", () => {
    win.maximize();
    win.show();
  });
  // Links (tela original da mesa, ajuda) abrem no navegador do sistema.
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // A janela do PC abre a MESMA página que os tablets: um código só pros dois.
  win.loadURL(devUrl ?? `http://127.0.0.1:${port}/`);
}

// Uma instância só: duas abertas brigariam pela mesma porta do servidor.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId("com.comvida.mesadesom");
    try {
      await startServer({
        port,
        staticDir: devUrl ? null : join(__dirname, "../renderer"),
        configPath: join(app.getPath("userData"), "config.json"),
        discover: discoverMixers,
        getUpdate: getUpdateStatus,
        installUpdate: installUpdateNow,
      });
    } catch (err) {
      dialog.showErrorBox(
        APP_TITLE,
        `Não consegui abrir a porta ${port} neste computador.\n` +
          `Talvez o programa já esteja aberto ou outro programa esteja usando essa porta.\n\n${String(err)}`,
      );
      app.quit();
      return;
    }
    createWindow();
    startUpdater();
  });

  app.on("window-all-closed", () => app.quit());
}
