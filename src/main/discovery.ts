import { randomBytes } from "crypto";
import { request } from "http";
import { Socket } from "net";
import { networkInterfaces } from "os";
import { DEFAULT_MIXER_IP } from "@shared/constants";
import type { FoundMixer } from "@shared/types";

// "Procurar mesa": varre a rede local atrás de Soundcraft Ui. Para cada
// endereço com a porta 80 aberta, faz a mesma conexão WebSocket que o app usa
// e espera a mesa se apresentar ("SETS^model^ui24"). Se não vier, confere a
// página da mesa como plano B.

const MODEL_NAMES: Record<string, string> = { ui24: "Ui24R", ui16: "Ui16", ui12: "Ui12" };

/** Endereços a testar: a /24 de cada placa de rede privada + o IP de fábrica do Wi-Fi da mesa. */
function candidates(): string[] {
  const ips = new Set<string>([DEFAULT_MIXER_IP]);
  // Só pros testes automáticos (mesa falsa em 127.0.0.x).
  for (const ip of (process.env["MESA_DISCOVER_EXTRA"] ?? "").split(",").filter(Boolean)) ips.add(ip.trim());
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family !== "IPv4" || ni.internal) continue;
      // Só redes privadas: VPN (100.64/10) e link-local não têm mesa.
      if (!/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ni.address)) continue;
      const base = ni.address.split(".").slice(0, 3).join(".");
      for (let h = 1; h <= 254; h++) {
        const ip = `${base}.${h}`;
        if (ip !== ni.address) ips.add(ip);
      }
    }
  }
  return [...ips];
}

function portOpen(ip: string, timeout = 700): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new Socket();
    const done = (ok: boolean) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(timeout, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
    s.connect(80, ip);
  });
}

/** Abre o WebSocket da mesa e procura o modelo nas primeiras mensagens. */
function askModel(ip: string, timeout = 2500): Promise<string | null> {
  return new Promise((resolve) => {
    const s = new Socket();
    let buf = "";
    const done = (v: string | null) => {
      s.destroy();
      resolve(v);
    };
    const timer = setTimeout(() => done(null), timeout);
    s.once("error", () => {
      clearTimeout(timer);
      done(null);
    });
    s.on("data", (chunk) => {
      buf += chunk.toString("latin1");
      const m = /\^model\^(ui\d+)/.exec(buf);
      if (m) {
        clearTimeout(timer);
        done(m[1]);
      } else if (buf.length > 200_000) {
        clearTimeout(timer);
        done(null);
      }
    });
    s.connect(80, ip, () => {
      s.write(
        `GET / HTTP/1.1\r\nHost: ${ip}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${randomBytes(16).toString("base64")}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
      );
    });
  });
}

/** Plano B: a página principal da mesa cita Soundcraft/Ui no HTML. */
function pageLooksLikeUi(ip: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request({ host: ip, port: 80, path: "/", timeout: 2000 }, (res) => {
      let body = "";
      res.setEncoding("utf-8");
      res.on("data", (c) => {
        body += c;
        if (body.length > 300_000) res.destroy();
      });
      res.on("end", () => resolve(/soundcraft|ui24r?|ui16|ui12/i.test(body)));
      res.on("error", () => resolve(false));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(false));
    req.end();
  });
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

let running: Promise<FoundMixer[]> | null = null;

export function discoverMixers(): Promise<FoundMixer[]> {
  // Dois aparelhos pedindo ao mesmo tempo dividem a mesma busca.
  running ??= (async () => {
    const ips = candidates();
    const open = (await pool(ips, 96, async (ip) => ((await portOpen(ip)) ? ip : null))).filter((x): x is string => !!x);
    const found = await pool(open, 16, async (ip): Promise<FoundMixer | null> => {
      const model = await askModel(ip);
      if (model) return { ip, model: MODEL_NAMES[model] ?? model.toUpperCase() };
      return (await pageLooksLikeUi(ip)) ? { ip, model: "Soundcraft Ui" } : null;
    });
    return found.filter((x): x is FoundMixer => !!x);
  })().finally(() => {
    running = null;
  });
  return running;
}
