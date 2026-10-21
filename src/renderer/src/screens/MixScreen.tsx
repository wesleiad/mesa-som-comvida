import { useState } from "react";
import type { StripKey } from "@shared/types";
import { BusStrip } from "../components/BusStrip";
import { ChannelSheet } from "../components/ChannelSheet";
import { Strip, type StripTarget } from "../components/Strip";
import { TechBusStrip, TechStrip } from "../components/TechStrip";
import { allStripKeys, useMixer } from "../lib/mixer";
import { useWide } from "../lib/useMedia";
import { useConfig } from "../state/config";
import { useUi } from "../state/ui";

const MASTER: StripTarget = { type: "master" };

/** Canais do visual básico (lista do técnico, ou todas as entradas se ele ainda não escolheu). */
export function useSimpleKeys(): StripKey[] {
  const caps = useMixer((s) => s.caps);
  const layout = useConfig((s) => s.config.simpleLayout);
  return layout.length ? layout : allStripKeys(caps)[0].keys;
}

/** Fileira de canais + a saída (Volume geral ou o retorno escolhido). */
export function StripRack({ target, busLabel }: { target: StripTarget; busLabel: string }) {
  const tech = useUi((s) => s.tech);
  const caps = useMixer((s) => s.caps);
  const simple = useSimpleKeys();
  const wide = useWide();
  const [detail, setDetail] = useState<StripKey | null>(null);
  const aux = target.type === "aux" ? target.aux : undefined;
  const sheet = detail && <ChannelSheet skey={detail} onClose={() => setDetail(null)} />;

  if (tech) {
    return (
      <div className="flex min-h-0 flex-1 gap-1.5 bg-[#111] p-1.5">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1">
          {allStripKeys(caps).map((g) => (
            <div key={g.title} className="flex h-full shrink-0 gap-1">
              <div className="flex w-5 shrink-0 items-center justify-center rounded bg-[#1b1b1b]">
                <span className="rotate-180 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase [writing-mode:vertical-rl]">{g.title}</span>
              </div>
              {g.keys.map((k) => (
                <TechStrip key={k} skey={k} target={target} onDetail={() => setDetail(k)} />
              ))}
            </div>
          ))}
        </div>
        <TechBusStrip aux={aux} label={busLabel} />
        {sheet}
      </div>
    );
  }

  if (wide) {
    return (
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          {simple.map((k) => (
            <Strip key={k} skey={k} target={target} vertical />
          ))}
        </div>
        <BusStrip aux={aux} label={busLabel} vertical />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/10 bg-neutral-950 p-2">
        <BusStrip aux={aux} label={busLabel} vertical={false} />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 pb-6">
        {simple.map((k) => (
          <Strip key={k} skey={k} target={target} vertical={false} />
        ))}
      </div>
    </div>
  );
}

export function MixScreen() {
  return <StripRack target={MASTER} busLabel="Volume geral" />;
}
