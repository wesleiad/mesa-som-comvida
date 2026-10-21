/** Tipos de canal das Soundcraft Ui que o app mostra como faixa (strip). */
export type StripKind = "i" | "l" | "p" | "f";

/** Chave estável de um canal, ex.: "i.0" (entrada 1), "l.0" (linha L), "p.0" (player L), "f.0" (FX 1). */
export type StripKey = `${StripKind}.${number}`;

/** Personalização de um canal feita no modo técnico. Tudo opcional: o que
 *  não estiver preenchido usa o nome que já está gravado na mesa. */
export interface StripSettings {
  label?: string;
  icon?: string;
  color?: string;
  /** Teto do fader no modo simples (dB). Evita voluntário "estourar" o som. */
  maxDb?: number;
}

export interface ReturnSettings {
  /** Número da AUX na mesa (1 = AUX 1). */
  aux: number;
  label: string;
  icon?: string;
}

export interface SceneButton {
  id: string;
  label: string;
  show: string;
  snapshot: string;
  color?: string;
}

export interface AppConfig {
  version: 1;
  mixerIp: string;
  /** Simulador: o app funciona sem mesa, pra treinar voluntários e testar. */
  simulator: boolean;
  /** Senha do modo técnico. */
  pin: string;
  /** Canais que aparecem no modo simples, na ordem. Vazio = todas as entradas da mesa. */
  simpleLayout: StripKey[];
  strips: Partial<Record<StripKey, StripSettings>>;
  /** Retornos (AUX) que aparecem pros voluntários. */
  returns: ReturnSettings[];
  scenes: SceneButton[];
  /** Pedir confirmação antes de silenciar tudo / trocar cena. */
  confirmDangerous: boolean;
  /** Ao abrir o programa no computador, liga o "Silenciar tudo" da mesa (segurança contra microfonia/estouro). */
  muteOnStart: boolean;
}

export interface UpdateStatus {
  state: "disabled" | "idle" | "checking" | "downloading" | "ready";
  current: string;
  next?: string;
  percent?: number;
  error?: string;
}

/** Mesa Soundcraft Ui encontrada na rede pelo "Procurar mesa". */
export interface FoundMixer {
  ip: string;
  /** "Ui24R", "Ui16", "Ui12" ou "Soundcraft Ui" quando não deu pra saber. */
  model: string;
}

export interface ServerInfo {
  port: number;
  /** Endereços do PC na rede local, pra abrir no tablet/celular. */
  addresses: string[];
}
