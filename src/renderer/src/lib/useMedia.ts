import { useSyncExternalStore } from "react";

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
  );
}

/** Tela larga (tablet deitado / PC): faders em pé. Celular: faders deitados, um embaixo do outro. */
export const useWide = () => useMedia("(min-width: 768px) and (min-height: 520px)");
