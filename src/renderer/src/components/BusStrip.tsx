import { useMemo } from "react";
import { mapObs, useMixer, useObs } from "../lib/mixer";
import { Fader, formatDb } from "./Fader";
import { VuMeter } from "./VuMeter";

/** Fader de saída: "Volume geral" (master) ou o volume total de um retorno (AUX). */
export function BusStrip({ aux, label, vertical }: { aux?: number; label: string; vertical: boolean }) {
  const ui = useMixer((s) => s.ui);
  const bus = useMemo(() => (ui ? (aux ? ui.master.aux(aux) : ui.master) : null), [ui, aux]);
  const vu = useMemo(() => {
    if (!ui) return null;
    return aux ? mapObs(ui.vuProcessor.aux(aux), (d) => d.vuPostFader) : mapObs(ui.vuProcessor.master(), (d) => Math.max(d.vuPostFaderL, d.vuPostFaderR));
  }, [ui, aux]);
  const level = useObs(bus?.faderLevel$, 0);
  const muteSrc = useMemo(() => (bus && "mute$" in bus ? bus.mute$ : null), [bus]);
  const muted = useObs(muteSrc, false);
  const color = "#fc2747";

  const muteBtn = bus && "toggleMute" in bus && (
    <button
      onClick={() => bus.toggleMute()}
      className={`shrink-0 rounded-xl font-bold ${muted ? "bg-red-600 text-white" : "bg-neutral-800 text-emerald-300 ring-1 ring-white/10"} ${
        vertical ? "h-12 w-full text-sm" : "h-14 w-[5.5rem] text-[11px] sm:w-24 sm:text-xs"
      }`}
      aria-pressed={muted}
    >
      {muted ? "MUTADO" : "DESMUTADO"}
    </button>
  );

  if (vertical) {
    return (
      <div className="flex h-full w-[8.5rem] shrink-0 flex-col items-center gap-2 rounded-2xl border border-brand-500/40 bg-gradient-to-b from-brand-500/15 to-neutral-950 p-2">
        <div className="py-2 text-center">
          <div className="text-3xl">{aux ? "🎧" : "🔊"}</div>
          <div className="text-sm font-bold leading-tight">{label}</div>
        </div>
        <div className="flex min-h-0 w-full flex-1 justify-center">
          <Fader value={level} onChange={(v) => bus?.setFaderLevel(v)} color={color} vertical meter={<VuMeter source={vu} vertical />} label={label} />
        </div>
        <div className="font-mono text-sm tabular-nums">{formatDb(level)} dB</div>
        {muteBtn}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-brand-500/40 bg-gradient-to-r from-brand-500/15 to-neutral-950 p-2">
      <div className="flex w-28 shrink-0 items-center gap-2 px-1 sm:w-36">
        <span className="text-2xl">{aux ? "🎧" : "🔊"}</span>
        <span className="text-[15px] font-bold leading-tight">{label}</span>
      </div>
      <div className="min-w-0 flex-1">
        <Fader value={level} onChange={(v) => bus?.setFaderLevel(v)} color={color} vertical={false} meter={<VuMeter source={vu} vertical={false} />} label={label} />
        <div className="mt-0.5 text-right font-mono text-xs tabular-nums text-neutral-400">{formatDb(level)} dB</div>
      </div>
      {muteBtn}
    </div>
  );
}
