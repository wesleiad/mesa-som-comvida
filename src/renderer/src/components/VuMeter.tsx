import { useEffect, useRef } from "react";
import { vuValueToDB } from "soundcraft-ui-connection";
import type { Observable } from "rxjs";

/** Converte o valor do medidor (0..1) pra altura visual, numa escala de −60 a 0 dB. */
function vuToFill(v: number): number {
  const db = vuValueToDB(v);
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

/**
 * Medidor de nível. Atualiza direto no DOM (sem re-render do React) porque
 * chega mensagem da mesa várias vezes por segundo pra cada canal.
 */
export function VuMeter({ source, vertical, slim }: { source: Observable<number> | null; vertical: boolean; slim?: boolean }) {
  const bar = useRef<HTMLDivElement>(null);
  const peak = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!source) return;
    let peakVal = 0;
    let peakAt = 0;
    const s = source.subscribe((v) => {
      const f = vuToFill(v);
      const now = performance.now();
      if (f >= peakVal || now - peakAt > 1200) {
        peakVal = f;
        peakAt = now;
      }
      if (bar.current) bar.current.style.transform = vertical ? `scaleY(${f})` : `scaleX(${f})`;
      if (peak.current) {
        peak.current.style[vertical ? "bottom" : "left"] = `${peakVal * 100}%`;
        peak.current.style.background = peakVal > 0.95 ? "#ff3b3b" : "rgba(255,255,255,.7)";
      }
    });
    return () => s.unsubscribe();
  }, [source, vertical]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={bar}
        className="vu-grad absolute inset-0 will-change-transform"
        style={{
          transformOrigin: vertical ? "bottom" : "left",
          transform: vertical ? "scaleY(0)" : "scaleX(0)",
          backgroundImage: vertical
            ? "linear-gradient(0deg, #16a34a 0%, #22c55e 60%, #facc15 85%, #ef4444 97%)"
            : "linear-gradient(90deg, #16a34a 0%, #22c55e 60%, #facc15 85%, #ef4444 97%)",
          opacity: slim ? 1 : 0.35,
        }}
      />
      {slim && <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, transparent 0 3px, #0a0a0a 3px 4px)" }} />}
      <div ref={peak} className={`absolute ${vertical ? "inset-x-0 h-0.5" : "inset-y-0 w-0.5"}`} />
    </div>
  );
}
