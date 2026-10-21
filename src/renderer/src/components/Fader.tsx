import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type WheelEvent } from "react";
import { DBToFaderValue, faderValueToDB } from "soundcraft-ui-connection";

interface Props {
  value: number;
  onChange: (v: number) => void;
  /** Teto (0..1). Acima disso o fader não sobe (visual básico). */
  max?: number;
  color: string;
  vertical: boolean;
  /** Medidor desenhado dentro do trilho. */
  meter?: ReactNode;
  label: string;
  disabled?: boolean;
}

export const MARKS = [10, 5, 0, -5, -10, -20, -30, -50];
const BASIC_MARKS = [10, 0, -10, -20, -40];

export function formatDb(v: number): string {
  const db = faderValueToDB(v);
  if (!Number.isFinite(db) || db < -90) return "−∞";
  const r = Math.round(db * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toFixed(1).replace(".", ",")}`;
}

/**
 * Arraste "relativo": encostar não pula o valor pro ponto tocado — só
 * arrastando ele anda. Evita sustos quando alguém esbarra na tela no culto.
 */
export function useRelativeDrag(opts: {
  value: number;
  onChange: (v: number) => void;
  vertical: boolean;
  max?: number;
  min?: number;
  disabled?: boolean;
  /** Valor ao tocar duas vezes (ex.: pan no centro). */
  reset?: number;
}) {
  const { value, onChange, vertical, max = 1, min = 0, disabled, reset } = opts;
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; startValue: number; size: number } | null>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return {
    ref,
    tabIndex: disabled ? -1 : 0,
    onPointerDown(e: PointerEvent) {
      if (disabled || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      ref.current.setPointerCapture(e.pointerId);
      drag.current = {
        start: vertical ? e.clientY : e.clientX,
        startValue: Math.min(value, max),
        size: (vertical ? r.height : r.width) * (e.shiftKey ? 4 : 1),
      };
    },
    onPointerMove(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const delta = ((vertical ? d.start - e.clientY : e.clientX - d.start) / d.size) * 0.9 * (max - min);
      onChange(clamp(d.startValue + delta));
    },
    onPointerUp() {
      drag.current = null;
    },
    onPointerCancel() {
      drag.current = null;
    },
    onDoubleClick() {
      if (reset != null && !disabled) onChange(reset);
    },
    onKeyDown(e: KeyboardEvent) {
      const step = (e.shiftKey ? 0.002 : 0.01) * (max - min);
      if (["ArrowUp", "ArrowRight"].includes(e.key)) onChange(clamp(value + step));
      else if (["ArrowDown", "ArrowLeft"].includes(e.key)) onChange(clamp(value - step));
      else return;
      e.preventDefault();
    },
    onWheel(e: WheelEvent) {
      if (!disabled) onChange(clamp(value + (e.deltaY < 0 ? 0.01 : -0.01) * (max - min)));
    },
  };
}

/** Fader grande do visual básico. */
export function Fader({ value, onChange, max = 1, color, vertical, meter, label, disabled }: Props) {
  const drag = useRelativeDrag({ value, onChange, vertical, max, disabled });
  const pct = Math.min(1, value) * 100;
  const capPct = max * 100;
  const pos = (p: number) => (vertical ? { bottom: `${p}%` } : { left: `${p}%` });

  return (
    <div
      {...drag}
      role="slider"
      data-kind="fader"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={value}
      aria-valuetext={`${formatDb(value)} dB`}
      className={`relative touch-none select-none rounded-2xl bg-neutral-900 ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        vertical ? "h-full w-16 cursor-ns-resize" : "h-14 w-full cursor-ew-resize"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {meter && <div className="pointer-events-none absolute inset-1.5 overflow-hidden rounded-xl">{meter}</div>}

      {max < 1 && (
        <div
          className="hatch pointer-events-none absolute rounded-xl"
          style={vertical ? { left: 4, right: 4, top: 4, bottom: `${capPct}%` } : { top: 4, bottom: 4, right: 4, left: `${capPct}%` }}
        />
      )}

      {BASIC_MARKS.map((db) => (
        <div key={db} className="pointer-events-none absolute" style={pos(DBToFaderValue(db) * 100)}>
          <div
            className={`${db === 0 ? "bg-white/50" : "bg-white/15"} ${
              vertical ? "absolute left-0 h-px w-16 translate-y-1/2" : "absolute top-0 h-14 w-px -translate-x-1/2"
            }`}
          />
        </div>
      ))}

      <div
        className="pointer-events-none absolute rounded-xl opacity-30"
        style={{
          background: color,
          ...(vertical ? { left: 22, right: 22, bottom: 6, height: `calc(${pct}% - 6px)` } : { top: 22, bottom: 22, left: 6, width: `calc(${pct}% - 6px)` }),
        }}
      />

      <div
        className="pointer-events-none absolute flex items-center justify-center rounded-lg shadow-lg shadow-black/60"
        style={{
          background: `linear-gradient(${vertical ? "180deg" : "90deg"}, #f5f5f5, #bdbdbd)`,
          ...(vertical
            ? { left: 2, right: 2, height: 30, bottom: `calc(${pct}% - 15px)` }
            : { top: 2, bottom: 2, width: 30, left: `calc(${pct}% - 15px)` }),
        }}
      >
        <div className={vertical ? "h-1 w-8 rounded" : "h-8 w-1 rounded"} style={{ background: color }} />
      </div>
    </div>
  );
}

/** Fader fino do visual técnico (estilo Mixing Station): sulco estreito, escala de dB ao lado. */
export function SlimFader({ value, onChange, label, color }: { value: number; onChange: (v: number) => void; label: string; color: string }) {
  const drag = useRelativeDrag({ value, onChange, vertical: true });
  const pct = Math.min(1, value) * 100;
  return (
    <div
      {...drag}
      role="slider"
      data-kind="fader"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={value}
      aria-valuetext={`${formatDb(value)} dB`}
      className="relative h-full w-full cursor-ns-resize touch-none select-none outline-none focus-visible:bg-white/5"
    >
      {/* escala */}
      {MARKS.map((db) => (
        <div key={db} className="pointer-events-none absolute right-1/2 left-0 flex items-center justify-end pr-3" style={{ bottom: `${DBToFaderValue(db) * 100}%`, transform: "translateY(50%)" }}>
          <span className={`mr-1 font-mono text-[9px] leading-none ${db === 0 ? "text-neutral-200" : "text-neutral-500"}`}>{db > 0 ? `+${db}` : db}</span>
          <span className={`h-px ${db === 0 ? "w-2 bg-neutral-300" : "w-1.5 bg-neutral-600"}`} />
        </div>
      ))}
      {/* sulco */}
      <div className="pointer-events-none absolute top-2 bottom-2 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 w-1.5 -translate-x-1/2 rounded-full opacity-70" style={{ height: `calc(${pct}% - 8px)`, background: color }} />
      {/* botão */}
      <div
        className="pointer-events-none absolute left-1/2 h-9 w-7 -translate-x-1/2 rounded-[5px] shadow-md shadow-black/70"
        style={{ bottom: `calc(${pct}% - 18px)`, background: "linear-gradient(180deg,#5a5a5a 0%,#2c2c2c 45%,#1a1a1a 55%,#3a3a3a 100%)" }}
      >
        <div className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 bg-white" />
      </div>
    </div>
  );
}
