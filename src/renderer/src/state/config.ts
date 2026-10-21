import { create } from "zustand";
import { SERVER_PORT } from "@shared/constants";
import { DEFAULT_CONFIG, normalizeConfig } from "@shared/defaults";
import type { AppConfig, StripKey, StripSettings } from "@shared/types";
import { isNativeApp } from "../lib/platform";

// De onde vêm os ajustes (nomes, grupos, cenas...):
// - programa do PC e navegador do tablet: do servidor do computador (mesma origem);
// - app Android: guardados no próprio aparelho, e sincronizados com o computador
//   da igreja quando ele estiver na rede (opcional). Funciona sem internet.

interface ConfigState {
  config: AppConfig;
  loaded: boolean;
  /** Em contato com o computador da igreja (ajustes sincronizados). */
  online: boolean;
  /** Este aparelho usa um computador da igreja (false = app Android sozinho). */
  hasPc: boolean;
}

export const useConfig = create<ConfigState>(() => ({
  config: DEFAULT_CONFIG,
  loaded: false,
  online: false,
  hasPc: !isNativeApp,
}));

const LOCAL_KEY = "mesa.config";
const PC_KEY = "mesa.pc";

/** "" = mesma origem; "http://ip:8077" = computador da igreja visto pelo app; null = sem computador. */
let apiBase: string | null = isNativeApp ? null : "";
let events: EventSource | null = null;

function readLocal(): AppConfig | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? normalizeConfig(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveLocal(cfg: AppConfig) {
  if (!isNativeApp) return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(cfg));
  } catch {
    /* aparelho sem espaço: segue só na memória */
  }
}

export function getPcAddress(): string {
  try {
    return localStorage.getItem(PC_KEY) ?? "";
  } catch {
    return "";
  }
}

function baseFor(addr: string): string {
  const a = addr.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return `http://${a.includes(":") ? a : `${a}:${SERVER_PORT}`}`;
}

async function connectServer(): Promise<boolean> {
  events?.close();
  events = null;
  if (apiBase === null) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${apiBase}/api/config`, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = normalizeConfig(await res.json());
    useConfig.setState({ config: cfg, loaded: true, online: true });
    saveLocal(cfg);
  } catch (err) {
    console.warn("[config] computador da igreja indisponível", err);
    useConfig.setState({ loaded: true, online: false });
    if (isNativeApp) return false;
  }
  // Quando outro aparelho muda algo (ex.: o técnico renomeia um canal no PC),
  // este aparelho atualiza sozinho.
  const es = new EventSource(`${apiBase}/api/events`);
  events = es;
  es.onmessage = (ev) => {
    const cfg = normalizeConfig(JSON.parse(ev.data));
    useConfig.setState({ config: cfg, online: true });
    saveLocal(cfg);
  };
  es.onerror = () => useConfig.setState({ online: false });
  es.onopen = () => useConfig.setState({ online: true });
  return useConfig.getState().online;
}

export async function initConfig(): Promise<void> {
  if (isNativeApp) {
    useConfig.setState({ config: readLocal() ?? DEFAULT_CONFIG, loaded: true });
    const pc = getPcAddress();
    apiBase = pc ? baseFor(pc) : null;
    useConfig.setState({ hasPc: !!pc });
    // Não segura a abertura do app esperando o computador responder.
    if (pc) void connectServer();
    return;
  }
  await connectServer();
}

/** App Android: liga (ou desliga, com "") a sincronização com o computador da igreja. */
export async function setPcAddress(addr: string): Promise<boolean> {
  try {
    if (addr.trim()) localStorage.setItem(PC_KEY, addr.trim());
    else localStorage.removeItem(PC_KEY);
  } catch {
    /* ignora */
  }
  apiBase = addr.trim() ? baseFor(addr) : null;
  useConfig.setState({ hasPc: !!addr.trim(), online: false });
  return connectServer();
}

let saveChain = Promise.resolve();

export function updateConfig(patch: Partial<AppConfig> | ((c: AppConfig) => Partial<AppConfig>)): void {
  const prev = useConfig.getState().config;
  const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
  useConfig.setState({ config: next });
  saveLocal(next);
  if (apiBase === null) return;
  const base = apiBase;
  // Salva em fila pra uma gravação antiga nunca chegar depois de uma nova.
  saveChain = saveChain.then(async () => {
    try {
      const res = await fetch(`${base}/api/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useConfig.getState().config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.warn("[config] não salvou no computador", err);
      useConfig.setState({ online: false });
    }
  });
}

export function updateStrip(key: StripKey, patch: StripSettings): void {
  updateConfig((c) => ({ strips: { ...c.strips, [key]: { ...c.strips[key], ...patch } } }));
}
