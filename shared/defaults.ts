import { DEFAULT_MIXER_IP } from "./constants";
import type { AppConfig, FlagGroup } from "./types";

/** Grupos que já vêm prontos (o técnico renomeia, cria e apaga em Ajustes). */
export const DEFAULT_GROUPS: FlagGroup[] = [
  { id: "mic-fio", name: "Mic com fio", icon: "🎤", color: "#4c8dff", kind: "channels" },
  { id: "mic-sem-fio", name: "Mic sem fio", icon: "📡", color: "#9b6bff", kind: "channels" },
  { id: "instrumentos", name: "Instrumentos", icon: "🎸", color: "#ff8a3d", kind: "channels" },
  { id: "outros", name: "Outros", icon: "💻", color: "#a3a3a3", kind: "channels" },
  { id: "ret-palco", name: "Retornos do palco", icon: "🔈", color: "#22b8cf", kind: "returns" },
  { id: "ret-inear", name: "In-ear", icon: "🎧", color: "#3ddc84", kind: "returns" },
];

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  mixerIp: DEFAULT_MIXER_IP,
  simulator: true,
  pin: "1234",
  simpleLayout: [],
  strips: {},
  returns: [],
  groups: DEFAULT_GROUPS,
  auxGroups: {},
  scenes: [],
  confirmDangerous: true,
  muteOnStart: true,
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
    groups: Array.isArray(c.groups) ? c.groups : DEFAULT_GROUPS,
    auxGroups: c.auxGroups && typeof c.auxGroups === "object" ? c.auxGroups : {},
    scenes: Array.isArray(c.scenes) ? c.scenes : [],
  };
}

/** Ícones disponíveis pros canais (emoji: funcionam em qualquer aparelho, sem baixar nada). */
export const STRIP_ICONS = [
  "🎤", "🗣️", "🎙️", "📡", "🎸", "🪕", "🎹", "🥁", "🎺", "🎷", "🎻", "🪈", "🔊", "🔈", "💻", "🎵", "📻", "📺", "🎧", "⛪",
];

/** Cores pra identificar canais/grupos (a primeira é o vermelho-coral da Comunidade Vida). */
export const STRIP_COLORS = [
  "#fc2747", "#ff8a3d", "#f5c518", "#3ddc84", "#22b8cf", "#4c8dff", "#9b6bff", "#ff5fa2", "#a3a3a3",
];
