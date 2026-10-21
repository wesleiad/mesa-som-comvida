import { DEFAULT_MIXER_IP } from "./constants";
import type { AppConfig } from "./types";

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  mixerIp: DEFAULT_MIXER_IP,
  simulator: true,
  pin: "1234",
  simpleLayout: [],
  strips: {},
  returns: [],
  scenes: [],
  confirmDangerous: true,
};

/** Completa um arquivo de configuração antigo/incompleto com os padrões,
 *  pra uma versão nova do app nunca quebrar com o config.json de antes. */
export function normalizeConfig(raw: unknown): AppConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<AppConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...c,
    version: 1,
    simpleLayout: Array.isArray(c.simpleLayout) ? c.simpleLayout : [],
    strips: c.strips && typeof c.strips === "object" ? c.strips : {},
    returns: Array.isArray(c.returns) ? c.returns : [],
    scenes: Array.isArray(c.scenes) ? c.scenes : [],
  };
}

/** Ícones disponíveis pros canais (emoji: funcionam em qualquer aparelho, sem baixar nada). */
export const STRIP_ICONS = [
  "🎤", "🗣️", "🎙️", "🎸", "🪕", "🎹", "🥁", "🎺", "🎷", "🎻", "🪈", "🔊", "💻", "🎵", "📻", "📺", "🎧", "⛪",
];

/** Cores pra identificar canais/grupos (a primeira é o vermelho-coral da Comunidade Vida). */
export const STRIP_COLORS = [
  "#fc2747", "#ff8a3d", "#f5c518", "#3ddc84", "#22b8cf", "#4c8dff", "#9b6bff", "#ff5fa2", "#a3a3a3",
];
