import { useEffect, useState } from "react";
import { create } from "zustand";
import {
  ConnectionStatus,
  DEVICE_CAPABILITIES,
  SoundcraftUI,
  type DeviceCapabilities,
  type MixerModel,
} from "soundcraft-ui-connection";
import type { Observable } from "rxjs";
import type { StripKey, StripKind } from "@shared/types";
import { SimSocket } from "./simSocket";

export type LinkState = "off" | "connecting" | "open" | "reconnecting" | "error";

interface MixerState {
  ui: SoundcraftUI | null;
  link: LinkState;
  model: MixerModel | null;
  caps: DeviceCapabilities;
  firmware: string;
  simulator: boolean;
  ip: string;
}

// Até a mesa responder, supõe a maior (Ui24R): o modelo real chega em milissegundos.
export const useMixer = create<MixerState>(() => ({
  ui: null,
  link: "off",
  model: null,
  caps: DEVICE_CAPABILITIES.ui24,
  firmware: "",
  simulator: false,
  ip: "",
}));

let current: SoundcraftUI | null = null;
const subs: { unsubscribe(): void }[] = [];

export async function connectMixer(ip: string, simulator: boolean): Promise<void> {
  const st = useMixer.getState();
  if (current && st.ip === ip && st.simulator === simulator) return;
  // Não espera a conexão antiga terminar de fechar: se ela já caiu, o
  // disconnect() da biblioteca pode nunca responder e a troca de mesa travava.
  disconnectMixer();

  const ui = new SoundcraftUI({
    targetIP: simulator ? "simulador" : ip.trim(),
    webSocketCtor: simulator ? (SimSocket as unknown as typeof WebSocket) : undefined,
  });
  current = ui;
  useMixer.setState({ ui, link: "connecting", model: null, firmware: "", ip, simulator });

  subs.push(
    ui.status$.subscribe((ev) => {
      if (current !== ui) return;
      const map: Partial<Record<ConnectionStatus, LinkState>> = {
        [ConnectionStatus.Opening]: "connecting",
        [ConnectionStatus.Open]: "open",
        [ConnectionStatus.Reconnecting]: "reconnecting",
        [ConnectionStatus.Error]: "error",
        [ConnectionStatus.Close]: "off",
      };
      const link = map[ev.type];
      if (link) useMixer.setState({ link });
    }),
    ui.deviceInfo.model$.subscribe((model) => {
      if (current !== ui || !DEVICE_CAPABILITIES[model]) return;
      useMixer.setState({ model, caps: DEVICE_CAPABILITIES[model] });
    }),
    ui.deviceInfo.firmware$.subscribe((firmware) => current === ui && useMixer.setState({ firmware })),
  );

  // A biblioteca já tenta reconectar sozinha quando a rede cai.
  ui.connect().catch((err) => console.warn("[mesa] falha ao conectar", err));
}

export function disconnectMixer(): void {
  const ui = current;
  current = null;
  subs.splice(0).forEach((s) => s.unsubscribe());
  useMixer.setState({ ui: null, link: "off" });
  ui?.disconnect().catch(() => {});
}

/** Valor atual de um Observable da biblioteca como estado do React. */
export function useObs<T>(obs$: Observable<T> | null | undefined, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    if (!obs$) return;
    const s = obs$.subscribe((v) => setValue(v));
    return () => s.unsubscribe();
  }, [obs$]);
  return value;
}

export function parseKey(key: StripKey): { kind: StripKind; n: number } {
  const [kind, idx] = key.split(".");
  return { kind: kind as StripKind, n: Number(idx) + 1 };
}

export const stripKey = (kind: StripKind, n: number): StripKey => `${kind}.${n - 1}`;

/** Todas as faixas que a mesa conectada tem, na ordem da própria mesa. */
export function allStripKeys(caps: DeviceCapabilities): { title: string; keys: StripKey[] }[] {
  const range = (kind: StripKind, count: number) => Array.from({ length: count }, (_, i) => stripKey(kind, i + 1));
  return [
    { title: "Entradas", keys: range("i", caps.input) },
    { title: "Linha e player", keys: [...range("l", caps.line), ...range("p", caps.player)] },
    { title: "Efeitos", keys: range("f", caps.fx) },
  ];
}

/** Canal do master (fader principal) de uma faixa. */
export function masterChannel(ui: SoundcraftUI, key: StripKey) {
  const { kind, n } = parseKey(key);
  switch (kind) {
    case "i":
      return ui.master.input(n);
    case "l":
      return ui.master.line(n);
    case "p":
      return ui.master.player(n);
    case "f":
      return ui.master.fx(n);
  }
}

/** Mandada de uma faixa pra um retorno (AUX). */
export function auxSend(ui: SoundcraftUI, aux: number, key: StripKey) {
  const { kind, n } = parseKey(key);
  const bus = ui.aux(aux);
  switch (kind) {
    case "i":
      return bus.input(n);
    case "l":
      return bus.line(n);
    case "p":
      return bus.player(n);
    case "f":
      return bus.fx(n);
  }
}

/** Medidor (0..1, pós-fader) de uma faixa. */
export function stripVu(ui: SoundcraftUI, key: StripKey): Observable<number> {
  const { kind, n } = parseKey(key);
  const v = ui.vuProcessor;
  switch (kind) {
    case "i":
      return mapObs(v.input(n), (d) => d.vuPostFader);
    case "l":
      return mapObs(v.line(n), (d) => d.vuPostFader);
    case "p":
      return mapObs(v.player(n), (d) => d.vuPostFader);
    case "f":
      return mapObs(v.fx(n), (d) => Math.max(d.vuPostFaderL, d.vuPostFaderR));
  }
}

/** `map` sem precisar importar outra cópia do rxjs (a biblioteca já traz a dela embutida). */
export function mapObs<A, B>(src: Observable<A>, fn: (a: A) => B): Observable<B> {
  return {
    subscribe(next: (b: B) => void) {
      return src.subscribe((a) => next(fn(a)));
    },
  } as unknown as Observable<B>;
}
