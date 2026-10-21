import { useMemo } from "react";
import { useConfig } from "../state/config";
import type { StripKey } from "@shared/types";
import { auxSend, mapObs, masterChannel, parseKey, stripVu, useMixer, useObs } from "../lib/mixer";
import { formatDb, SlimFader, useRelativeDrag } from "./Fader";
import { useStripLook, type StripTarget } from "./Strip";
import { VuMeter } from "./VuMeter";

// Visual técnico, inspirado no Mixing Station: faixas estreitas, número do
// canal em cima, ganho/48V, pan, mute e solo, fader fino com escala de dB e
// medidor separado, e o nome numa etiqueta colorida embaixo.

const KIND_PREFIX: Record<string, string> = { i: "", l: "L", p: "P", f: "FX" };

function PanBar({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const drag = useRelativeDrag({ value, onChange, vertical: false, reset: 0.5 });
  const left = Math.min(value, 0.5) * 100;
  const width = Math.abs(value - 0.5) * 100;
  const text = value < 0.49 ? `E${Math.round((0.5 - value) * 200)}` : value > 0.51 ? `D${Math.round((value - 0.5) * 200)}` : "C";
  return (
    <div
      {...drag}
      role="slider"
      data-kind="pan"
      aria-label="Pan"
      aria-valuenow={value}
      title="Pan — arraste pros lados, toque duas vezes pra centralizar"
      className="relative h-4 w-full cursor-ew-resize touch-none rounded-sm bg-black ring-1 ring-white/10"
    >
      <div className="absolute inset-y-0.5 rounded-sm bg-sky-400/70" style={{ left: `${left}%`, width: `${width}%` }} />
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] text-neutral-200">{text}</span>
    </div>
  );
}

export function MuteButton({ muted, onClick, small }: { muted: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={muted}
      className={`w-full rounded-sm font-bold tracking-tighter transition active:scale-95 ${small ? "h-7 text-[8.5px]" : "h-12 text-xs"} ${
        muted ? "bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,.5)]" : "bg-[#2a2a2a] text-neutral-300 ring-1 ring-white/10"
      }`}
    >
      {muted ? "MUTADO" : "DESMUTADO"}
    </button>
  );
}

export function TechStrip({ skey, target, onDetail }: { skey: StripKey; target: StripTarget; onDetail?: () => void }) {
  const ui = useMixer((s) => s.ui);
  const look = useStripLook(skey);
  const flags = useConfig((s) => s.config.strips[skey]?.groups);
  const groups = useConfig((s) => s.config.groups);
  const { kind, n } = parseKey(skey);
  const auxN = target.type === "aux" ? target.aux : 0;
  const ch = useMemo(() => (ui ? (auxN ? auxSend(ui, auxN, skey) : masterChannel(ui, skey)) : null), [ui, skey, auxN]);
  const hw = useMemo(() => (ui && kind === "i" ? ui.hw(n) : null), [ui, kind, n]);
  const vu = useMemo(() => (ui ? stripVu(ui, skey) : null), [ui, skey]);
  const level = useObs(ch?.faderLevel$, 0);
  const muted = useObs(ch?.mute$, false);
  const pan = useObs(ch && "pan$" in ch ? ch.pan$ : null, 0.5);
  const solo = useObs(ch && "solo$" in ch ? ch.solo$ : null, false);
  const gain = useObs(hw?.gainDB$, 0);
  const phantom = useObs(hw?.phantom$, false);
  const myGroups = groups.filter((g) => flags?.includes(g.id));

  return (
    <div className={`flex h-full w-16 shrink-0 flex-col gap-0.5 rounded border bg-[#1b1b1b] p-0.5 ${solo ? "border-amber-400/70" : "border-white/5"}`}>
      <button onClick={onDetail} className="flex h-5 items-center justify-between rounded-sm px-1 text-[10px] font-bold text-black" style={{ background: look.color }}>
        <span>
          {KIND_PREFIX[kind]}
          {n}
        </span>
        <span className="text-[9px]">{look.icon}</span>
      </button>

      {/* grupos (flags) do canal */}
      <div className="flex h-2 items-center justify-center gap-0.5" title={myGroups.map((g) => g.name).join(", ") || "Sem grupo"}>
        {myGroups.map((g) => (
          <span key={g.id} className="h-1.5 w-2.5 rounded-full" style={{ background: g.color }} />
        ))}
      </div>

      <button onClick={onDetail} className="flex h-5 items-center justify-between rounded-sm bg-black/60 px-0.5 font-mono text-[9px] text-neutral-300 ring-1 ring-white/5" title="Ganho e 48V">
        {hw ? (
          <>
            <span className={phantom ? "rounded-sm bg-red-600 px-0.5 font-bold text-white" : "text-neutral-600"}>48V</span>
            <span>{gain > 0 ? "+" : ""}{gain.toFixed(0)}</span>
          </>
        ) : (
          <span className="w-full text-center text-neutral-600">—</span>
        )}
      </button>

      {ch && "setPan" in ch ? <PanBar value={pan} onChange={(v) => ch.setPan(v)} /> : <div className="h-4" />}

      <MuteButton muted={muted} onClick={() => ch?.toggleMute()} small />
      {ch && "toggleSolo" in ch ? (
        <button
          onClick={() => ch.toggleSolo()}
          aria-pressed={solo}
          className={`h-6 w-full rounded-sm text-[9px] font-bold ${solo ? "bg-amber-400 text-black" : "bg-[#2a2a2a] text-neutral-400 ring-1 ring-white/10"}`}
        >
          SOLO
        </button>
      ) : (
        <div className="h-6" />
      )}

      <div className="flex min-h-0 flex-1 gap-0.5 py-0.5">
        <div className="min-w-0 flex-1">
          <SlimFader value={level} onChange={(v) => ch?.setFaderLevel(v)} label={look.name} color={look.color} />
        </div>
        <div className="w-1.5 overflow-hidden rounded-sm bg-black">
          <VuMeter source={vu} vertical slim />
        </div>
      </div>

      <div className="text-center font-mono text-[10px] tabular-nums text-neutral-300">{formatDb(level)}</div>
      <button
        onClick={onDetail}
        className="line-clamp-2 flex min-h-8 items-center justify-center rounded-sm px-0.5 text-center text-[10px] leading-tight font-semibold break-words"
        style={{ background: `${look.color}33`, boxShadow: `inset 0 -3px 0 ${look.color}` }}
        title="Ajustar canal"
      >
        {look.name}
      </button>
    </div>
  );
}

/** Saída no visual técnico: master (L/R) ou o total de um retorno. */
export function TechBusStrip({ aux, label }: { aux?: number; label: string }) {
  const ui = useMixer((s) => s.ui);
  const bus = useMemo(() => (ui ? (aux ? ui.master.aux(aux) : ui.master) : null), [ui, aux]);
  const vuL = useMemo(() => (ui ? (aux ? mapObs(ui.vuProcessor.aux(aux), (d) => d.vuPostFader) : mapObs(ui.vuProcessor.master(), (d) => d.vuPostFaderL)) : null), [ui, aux]);
  const vuR = useMemo(() => (ui && !aux ? mapObs(ui.vuProcessor.master(), (d) => d.vuPostFaderR) : null), [ui, aux]);
  const level = useObs(bus?.faderLevel$, 0);
  const muteSrc = useMemo(() => (bus && "mute$" in bus ? bus.mute$ : null), [bus]);
  const muted = useObs(muteSrc, false);
  const hasDim = useMixer((s) => s.caps.masterDim) && !aux;
  const dimSrc = useMemo(() => (hasDim && bus && "dim$" in bus ? bus.dim$ : null), [bus, hasDim]);
  const dim = useObs(dimSrc, false);

  return (
    <div className="flex h-full w-[5rem] shrink-0 flex-col gap-0.5 rounded border border-brand-500/50 bg-[#211416] p-0.5">
      <div className="flex h-5 items-center justify-center rounded-sm bg-brand-500 text-[10px] font-bold text-white">{aux ? `AUX ${aux}` : "MASTER"}</div>
      <div className="h-2" />
      <div className="h-5" />
      <div className="h-4" />
      {bus && "toggleMute" in bus ? <MuteButton muted={muted} onClick={() => bus.toggleMute()} small /> : <div className="h-7" />}
      {hasDim && bus && "toggleDim" in bus ? (
        <button onClick={() => bus.toggleDim()} aria-pressed={dim} className={`h-6 w-full rounded-sm text-[9px] font-bold ${dim ? "bg-sky-400 text-black" : "bg-[#2a2a2a] text-neutral-400 ring-1 ring-white/10"}`}>
          DIM
        </button>
      ) : (
        <div className="h-6" />
      )}
      <div className="flex min-h-0 flex-1 gap-0.5 py-0.5">
        <div className="min-w-0 flex-1">
          <SlimFader value={level} onChange={(v) => bus?.setFaderLevel(v)} label={label} color="#fc2747" />
        </div>
        <div className="w-1.5 overflow-hidden rounded-sm bg-black">
          <VuMeter source={vuL} vertical slim />
        </div>
        {vuR && (
          <div className="w-1.5 overflow-hidden rounded-sm bg-black">
            <VuMeter source={vuR} vertical slim />
          </div>
        )}
      </div>
      <div className="text-center font-mono text-[10px] tabular-nums">{formatDb(level)}</div>
      <div className="flex min-h-8 items-center justify-center rounded-sm bg-brand-500/25 px-0.5 text-center text-[10px] leading-tight font-bold shadow-[inset_0_-3px_0_#fc2747]">{label}</div>
    </div>
  );
}
