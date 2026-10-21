import { create } from "zustand";
import { DEFAULT_CONFIG, normalizeConfig } from "@shared/defaults";
import type { AppConfig, StripKey, StripSettings } from "@shared/types";

interface ConfigState {
  config: AppConfig;
  loaded: boolean;
  /** false quando o PC (servidor) está fora do ar: as mudanças não ficam salvas. */
  online: boolean;
}

export const useConfig = create<ConfigState>(() => ({
  config: DEFAULT_CONFIG,
  loaded: false,
  online: false,
}));

export async function initConfig(): Promise<void> {
  try {
    const res = await fetch("/api/config", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    useConfig.setState({ config: normalizeConfig(await res.json()), loaded: true, online: true });
  } catch (err) {
    console.warn("[config] servidor indisponível, usando padrão", err);
    useConfig.setState({ loaded: true, online: false });
  }
  // Quando outro aparelho muda algo (ex.: o técnico renomeia um canal no PC),
  // o tablet do voluntário atualiza sozinho.
  const es = new EventSource("/api/events");
  es.onmessage = (ev) => useConfig.setState({ config: normalizeConfig(JSON.parse(ev.data)), online: true });
  es.onerror = () => useConfig.setState({ online: false });
  es.onopen = () => useConfig.setState({ online: true });
}

let saveChain = Promise.resolve();

export function updateConfig(patch: Partial<AppConfig> | ((c: AppConfig) => Partial<AppConfig>)): void {
  const prev = useConfig.getState().config;
  const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
  useConfig.setState({ config: next });
  // Salva em fila pra uma gravação antiga nunca chegar depois de uma nova.
  saveChain = saveChain.then(async () => {
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useConfig.getState().config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.warn("[config] não salvou", err);
      useConfig.setState({ online: false });
    }
  });
}

export function updateStrip(key: StripKey, patch: StripSettings): void {
  updateConfig((c) => ({ strips: { ...c.strips, [key]: { ...c.strips[key], ...patch } } }));
}
