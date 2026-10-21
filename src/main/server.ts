import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { promises as fs } from "fs";
import { networkInterfaces } from "os";
import { dirname, extname, join, normalize, sep } from "path";
import { normalizeConfig } from "@shared/defaults";
import type { AppConfig, FoundMixer, ServerInfo, UpdateStatus } from "@shared/types";

// Servidor HTTP embutido. Faz duas coisas:
//  1) serve a própria tela do app, pra tablets/celulares abrirem no navegador;
//  2) guarda a configuração (nomes, cores, cenas...) num arquivo só no PC,
//     e avisa todos os aparelhos abertos quando alguém muda alguma coisa.
// A conexão com a mesa NÃO passa por aqui: cada aparelho fala direto com a
// Soundcraft (ela aceita vários controles ao mesmo tempo).

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === "IPv4" && !ni.internal && !ni.address.startsWith("169.254.")) out.push(ni.address);
    }
  }
  // Wi-Fi/rede da igreja primeiro: endereços de VPN (ex.: Tailscale 100.64.0.0/10)
  // aparecem por último porque o tablet não chega neles.
  const isPrivate = (a: string) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a);
  return out.sort((a, b) => Number(isPrivate(b)) - Number(isPrivate(a)));
}

interface ServerOptions {
  port: number;
  staticDir: string | null;
  configPath: string;
  discover: () => Promise<FoundMixer[]>;
  getUpdate: () => UpdateStatus;
  installUpdate: () => boolean;
}

export async function startServer(opts: ServerOptions) {
  const { port, staticDir, configPath } = opts;
  const listeners = new Set<ServerResponse>();

  async function loadConfig(): Promise<AppConfig> {
    try {
      return normalizeConfig(JSON.parse(await fs.readFile(configPath, "utf-8")));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        // Arquivo corrompido: guarda uma cópia e começa do padrão em vez de travar.
        await fs.copyFile(configPath, `${configPath}.corrompido-${Date.now()}`).catch(() => {});
      }
      return normalizeConfig({});
    }
  }

  async function saveConfig(cfg: AppConfig): Promise<void> {
    await fs.mkdir(dirname(configPath), { recursive: true });
    // Grava num temporário e renomeia: se o PC desligar no meio, o arquivo anterior fica inteiro.
    await fs.writeFile(`${configPath}.tmp`, JSON.stringify(cfg, null, 2), "utf-8");
    await fs.rename(`${configPath}.tmp`, configPath);
  }

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.setEncoding("utf-8");
      req.on("data", (chunk) => {
        data += chunk;
        if (data.length > 2_000_000) reject(new Error("corpo grande demais"));
      });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  }

  function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  }

  async function serveStatic(req: IncomingMessage, res: ServerResponse) {
    if (!staticDir) {
      res.writeHead(404).end();
      return;
    }
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let file = normalize(join(staticDir, urlPath));
    if (!file.startsWith(normalize(staticDir + sep)) && file !== normalize(staticDir)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const st = await fs.stat(file);
      if (st.isDirectory()) file = join(file, "index.html");
    } catch {
      // Rota desconhecida: entrega a tela principal.
      file = join(staticDir, "index.html");
    }
    try {
      const data = await fs.readFile(file);
      const isIndex = file.endsWith("index.html");
      res.writeHead(200, {
        "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
        // Os arquivos de /assets têm hash no nome; a tela principal nunca fica em cache
        // pra que o tablet pegue a versão nova logo depois de atualizar o app no PC.
        "Cache-Control": isIndex ? "no-store" : "public, max-age=31536000, immutable",
      });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  }

  const server = createServer(async (req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    // O app Android sincroniza os ajustes com este computador pela rede (outra origem).
    if (url.startsWith("/api/")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
      }
    }
    try {
      if (url === "/api/config" && req.method === "GET") return json(res, 200, await loadConfig());
      if (url === "/api/config" && req.method === "PUT") {
        const cfg = normalizeConfig(JSON.parse(await readBody(req)));
        await saveConfig(cfg);
        const msg = `data: ${JSON.stringify(cfg)}\n\n`;
        for (const l of listeners) l.write(msg);
        return json(res, 200, cfg);
      }
      if (url === "/api/info") {
        const info: ServerInfo = { port, addresses: lanAddresses() };
        return json(res, 200, info);
      }
      if (url === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
        });
        res.write(": ok\n\n");
        listeners.add(res);
        const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
        req.on("close", () => {
          clearInterval(ping);
          listeners.delete(res);
        });
        return;
      }
      if (url === "/api/discover") return json(res, 200, await opts.discover());
      if (url === "/api/update" && req.method === "GET") return json(res, 200, opts.getUpdate());
      if (url === "/api/update/install" && req.method === "POST") {
        // Só o próprio PC pode mandar reiniciar o programa, não um tablet qualquer.
        const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
        if (!local) return json(res, 403, { error: "só no computador" });
        return json(res, 200, { ok: opts.installUpdate() });
      }
      if (url.startsWith("/api/")) return json(res, 404, { error: "não encontrado" });
      return serveStatic(req, res);
    } catch (err) {
      console.error("[server]", err);
      if (!res.headersSent) json(res, 500, { error: String(err) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => resolve());
  });
  return server;
}
