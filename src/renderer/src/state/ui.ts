import { create } from "zustand";

export type Tab = "mix" | "returns" | "scenes" | "settings";

interface UiState {
  tab: Tab;
  /** Visual técnico desbloqueado (por aparelho; volta pro simples ao recarregar). */
  tech: boolean;
  /** Retorno selecionado na aba Retornos (número da AUX). */
  aux: number | null;
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = sessionStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export const useUi = create<UiState>(() => ({
  tab: load<Tab>("ui.tab", "mix"),
  tech: load("ui.tech", false),
  aux: load<number | null>("ui.aux", null),
}));

useUi.subscribe((s) => {
  try {
    sessionStorage.setItem("ui.tab", JSON.stringify(s.tab));
    sessionStorage.setItem("ui.tech", JSON.stringify(s.tech));
    sessionStorage.setItem("ui.aux", JSON.stringify(s.aux));
  } catch {
    /* navegador sem armazenamento: só não lembra a aba */
  }
});
