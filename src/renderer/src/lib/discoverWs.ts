import { DEFAULT_MIXER_IP } from "@shared/constants";
import type { FoundMixer } from "@shared/types";

// "Procurar mesa" dentro do app Android (sem o computador): o app não sabe o
// próprio IP, então testa o IP de fábrica da mesa, as redes dos endereços que
// ele já conhece e as faixas mais comuns de roteador. Em cada endereço abre o
// mesmo WebSocket que o programa usa e espera a mesa dizer o modelo.

const MODEL_NAMES: Record<string, string> = { ui24: "Ui24R", ui16: "Ui16", ui12: "Ui12" };
const COMMON = ["192.168.0", "192.168.1", "10.10.1", "10.0.0", "192.168.15", "192.168.100"];

function probe(ip: string, timeout = 1500): Promise<FoundMixer | null> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${ip}`);
    } catch {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (v: FoundMixer | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* já fechado */
      }
      resolve(v);
    };
    // Abriu mas a mesa ainda não falou: dá mais um tempinho.
    let timer = setTimeout(() => finish(null), timeout);
    ws.onopen = () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(null), 2500);
    };
    ws.onmessage = (ev) => {
      const m = /\^model\^(ui\d+)/.exec(String(ev.data));
      if (m) finish({ ip, model: MODEL_NAMES[m[1]] ?? m[1].toUpperCase() });
    };
    ws.onerror = () => finish(null);
    ws.onclose = () => finish(null);
  });
}

export async function discoverOnDevice(known: string[], onProgress: (pct: number, found: FoundMixer[]) => void): Promise<FoundMixer[]> {
  const prefixes = new Set<string>();
  for (const a of known) {
    const m = /^(\d+\.\d+\.\d+)\.\d+/.exec(a.trim());
    if (m) prefixes.add(m[1]);
  }
  COMMON.forEach((p) => prefixes.add(p));
  const ips = [DEFAULT_MIXER_IP, ...known.filter((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a.trim()))];
  for (const p of prefixes) for (let h = 1; h <= 254; h++) ips.push(`${p}.${h}`);
  const list = [...new Set(ips)];

  const found: FoundMixer[] = [];
  let next = 0;
  let doneCount = 0;
  await Promise.all(
    Array.from({ length: 48 }, async () => {
      while (next < list.length) {
        const ip = list[next++];
        const r = await probe(ip);
        doneCount++;
        if (r && !found.some((f) => f.ip === r.ip)) found.push(r);
        if (doneCount % 16 === 0 || r) onProgress(Math.round((doneCount / list.length) * 100), [...found]);
      }
    }),
  );
  onProgress(100, found);
  return found;
}
