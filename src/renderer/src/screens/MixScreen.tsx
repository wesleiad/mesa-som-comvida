import { useRef, useState } from "react";
import type { StripKey } from "@shared/types";
import { BusStrip } from "../components/BusStrip";
import { ChannelSheet } from "../components/ChannelSheet";
import { GroupBar } from "../components/GroupBar";
import { Strip, type StripTarget } from "../components/Strip";
import { TechBusStrip, TechStrip } from "../components/TechStrip";
import { allStripKeys, parseKey, useMixer } from "../lib/mixer";
import { useWide } from "../lib/useMedia";
import { useConfig } from "../state/config";
import { useUi } from "../state/ui";

const MASTER: StripTarget = { type: "master" };

/** Canais do visual básico (lista do técnico, ou todas as entradas se ele ainda não escolheu).
 *  Efeitos (FX) ficam travados no básico: nunca aparecem lá. */
export function useSimpleKeys(): StripKey[] {
  const caps = useMixer((s) => s.caps);
  const layout = useConfig((s) => s.config.simpleLayout);
  return (layout.length ? layout : allStripKeys(caps)[0].keys).filter((k) => parseKey(k).kind !== "f");
}

/** Bancos de 8 canais pra pular direto, como as "layers" do Mixing Station. */
function useBanks(): { label: string; first: StripKey }[] {
  const caps = useMixer((s) => s.caps);
  const groups = allStripKeys(caps);
  const banks: { label: string; first: StripKey }[] = [];
  const inputs = groups[0].keys;
  for (let i = 0; i < inputs.length; i += 8) banks.push({ label: `${i + 1}–${Math.min(i + 8, inputs.length)}`, first: inputs[i] });
  if (groups[1].keys.length) banks.push({ label: "Linha/Player", first: groups[1].keys[0] });
  if (groups[2].keys.length) banks.push({ label: "Efeitos", first: groups[2].keys[0] });
  return banks;
}

/** Fileira de canais + a saída (Volume geral ou o retorno escolhido). */
export function StripRack({ target, busLabel }: { target: StripTarget; busLabel: string }) {
  const tech = useUi((s) => s.tech);
  const caps = useMixer((s) => s.caps);
  const simple = useSimpleKeys();
  const wide = useWide();
  const banks = useBanks();
  const scroller = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<StripKey | null>(null);
  const aux = target.type === "aux" ? target.aux : undefined;
  const sheet = detail && <ChannelSheet skey={detail} onClose={() => setDetail(null)} />;
  const groupBar = <GroupBar ctx={aux ? { type: "aux", aux } : { type: "master" }} />;

  function jump(k: StripKey) {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-strip="${k}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  if (tech) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {groupBar}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10 bg-[#141414] px-2 py-1">
          <span className="shrink-0 pr-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Ir para</span>
          {banks.map((b) => (
            <button key={b.label} onClick={() => jump(b.first)} className="h-7 shrink-0 rounded bg-[#242424] px-2.5 text-xs font-semibold text-neutral-300 ring-1 ring-white/10 active:bg-brand-500">
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 gap-1 bg-[#111] p-1">
          <div ref={scroller} className="flex min-w-0 flex-1 snap-x gap-0.5 overflow-x-auto pb-1">
            {allStripKeys(caps).map((g) =>
              g.keys.map((k) => (
                <div key={k} data-strip={k} className="h-full shrink-0 snap-start">
                  <TechStrip skey={k} target={target} onDetail={() => setDetail(k)} />
                </div>
              )),
            )}
          </div>
          <TechBusStrip aux={aux} label={busLabel} />
        </div>
        {sheet}
      </div>
    );
  }

  if (wide) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {groupBar}
        <div className="flex min-h-0 flex-1 gap-2 p-2">
          <div className="flex min-w-0 flex-1 snap-x gap-1.5 overflow-x-auto pb-1">
            {simple.map((k) => (
              <div key={k} className="h-full shrink-0 snap-start">
                <Strip skey={k} target={target} vertical />
              </div>
            ))}
          </div>
          <BusStrip aux={aux} label={busLabel} vertical />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {groupBar}
      <div className="border-b border-white/10 bg-neutral-950 p-1.5">
        <BusStrip aux={aux} label={busLabel} vertical={false} />
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5 pb-6">
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
