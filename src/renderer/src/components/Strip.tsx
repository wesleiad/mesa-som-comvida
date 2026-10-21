import { useMemo } from "react";
import { DBToFaderValue } from "soundcraft-ui-connection";
import type { StripKey } from "@shared/types";
import { auxSend, masterChannel, stripVu, useMixer, useObs } from "../lib/mixer";
import { useConfig } from "../state/config";
import { Fader, formatDb } from "./Fader";
import { VuMeter } from "./VuMeter";

export type StripTarget = { type: "master" } | { type: "aux"; aux: number };

const DEFAULT_ICON: Record<string, string> = { i: "🎤", l: "🔌", p: "🎵", f: "✨" };

export function useStripLook(key: StripKey) {
  const ui = useMixer((s) => s.ui);
  const cfg = useConfig((s) => s.config.strips[key]);
  const ch = useMemo(() => (ui ? masterChannel(ui, key) : null), [ui, key]);
  const mixerName = useObs(ch?.name$, "");
  return {
    name: cfg?.label?.trim() || mixerName || key,
    mixerName,
    icon: cfg?.icon || DEFAULT_ICON[key[0]],
    color: cfg?.color || "#fc2747",
    maxDb: cfg?.maxDb,
  };
}


interface Props {
  skey: StripKey;
  target: StripTarget;
  vertical: boolean;
}

/** Faixa do visual básico: ícone, nome grande, fader largo e mutado/desmutado. */
export function Strip({ skey, target, vertical }: Props) {
  const ui = useMixer((s) => s.ui);
  const look = useStripLook(skey);
  const auxN = target.type === "aux" ? target.aux : 0;
  const ch = useMemo(() => {
    if (!ui) return null;
    return auxN ? auxSend(ui, auxN, skey) : masterChannel(ui, skey);
  }, [ui, skey, auxN]);
  const level = useObs(ch?.faderLevel$, 0);
  const muted = useObs(ch?.mute$, false);
  const vu = useMemo(() => (ui ? stripVu(ui, skey) : null), [ui, skey]);

  // O teto do técnico só vale no som da igreja (master), não nos retornos.
  const max = target.type === "master" && look.maxDb != null ? DBToFaderValue(look.maxDb) : 1;
  const set = (v: number) => ch?.setFaderLevel(v);

  const muteBtn = (
    <button
      onClick={() => ch?.toggleMute()}
      className={`shrink-0 rounded-xl font-bold transition active:scale-95 ${
        muted ? "bg-red-600 text-white shadow-[0_0_18px_rgba(239,68,68,.45)]" : "bg-neutral-800 text-emerald-300 ring-1 ring-white/10"
      } ${vertical ? "h-12 w-full text-sm" : "h-14 w-[5.5rem] text-[11px] sm:w-24 sm:text-xs"}`}
      aria-pressed={muted}
    >
      {muted ? "MUTADO" : "DESMUTADO"}
    </button>
  );

  const head = (
    <div className={`flex min-w-0 items-center gap-2 ${vertical ? "w-full flex-col gap-1 px-1 py-2 text-center" : "w-[6.5rem] shrink-0 sm:w-36"}`}>
      <span className={vertical ? "text-3xl" : "text-xl sm:text-2xl"}>{look.icon}</span>
      <span className={`line-clamp-2 leading-tight font-semibold break-words ${vertical ? "text-sm" : "min-w-0 text-sm sm:text-[15px]"}`}>{look.name}</span>
    </div>
  );

  if (vertical) {
    return (
      <div className={`flex h-full w-[7.5rem] shrink-0 flex-col items-center gap-2 rounded-2xl border bg-neutral-950/80 p-2 ${muted ? "border-red-600/40" : "border-white/10"}`}>
        <div className="h-1.5 w-full rounded-full" style={{ background: look.color }} />
        {head}
        <div className="flex min-h-0 w-full flex-1 justify-center">
          <Fader value={level} onChange={set} max={max} color={look.color} vertical meter={<VuMeter source={vu} vertical />} label={look.name} />
        </div>
        <div className="font-mono text-sm tabular-nums text-neutral-300">{formatDb(level)} dB</div>
        {muteBtn}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 rounded-2xl border bg-neutral-950/80 p-2 ${muted ? "border-red-600/40" : "border-white/10"}`}>
      <div className="h-12 w-1.5 shrink-0 rounded-full" style={{ background: look.color }} />
      {head}
      <div className="min-w-0 flex-1">
        <Fader value={level} onChange={set} max={max} color={look.color} vertical={false} meter={<VuMeter source={vu} vertical={false} />} label={look.name} />
        <div className="mt-0.5 text-right font-mono text-xs tabular-nums text-neutral-400">{formatDb(level)} dB</div>
      </div>
      {muteBtn}
    </div>
  );
}
