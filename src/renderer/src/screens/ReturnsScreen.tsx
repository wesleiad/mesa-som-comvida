import { useMemo, useState } from "react";
import type { ReturnSettings } from "@shared/types";
import type { StripTarget } from "../components/Strip";
import { useMixer, useObs } from "../lib/mixer";
import { updateConfig, useConfig } from "../state/config";
import { useUi } from "../state/ui";
import { StripRack } from "./MixScreen";

function useAuxName(aux: number): string {
  const ui = useMixer((s) => s.ui);
  const ret = useConfig((s) => s.config.returns.find((r) => r.aux === aux));
  const ch = useMemo(() => (ui ? ui.master.aux(aux) : null), [ui, aux]);
  const mixerName = useObs(ch?.name$, `AUX ${aux}`);
  return ret?.label?.trim() || mixerName;
}

function ReturnButton({ aux, active, onClick, big }: { aux: number; active: boolean; onClick: () => void; big?: boolean }) {
  const name = useAuxName(aux);
  const icon = useConfig((s) => s.config.returns.find((r) => r.aux === aux)?.icon) ?? "🎧";
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-2xl font-semibold transition active:scale-95 ${active ? "btn-brand" : "btn-ghost"} ${
        big ? "flex h-28 flex-col items-center justify-center gap-1 text-lg" : "h-11 px-4 text-sm"
      }`}
    >
      {big && <span className="text-3xl">{icon}</span>}
      <span className="leading-tight">{name}</span>
    </button>
  );
}

function ReturnEditor({ aux }: { aux: number }) {
  const ret = useConfig((s) => s.config.returns.find((r) => r.aux === aux));
  const [label, setLabel] = useState(ret?.label ?? "");
  const save = (patch: Partial<ReturnSettings> | null) =>
    updateConfig((c) => {
      const others = c.returns.filter((r) => r.aux !== aux);
      if (!patch) return { returns: others };
      const next = { aux, label: label.trim(), ...ret, ...patch };
      return { returns: [...others, next].sort((a, b) => a.aux - b.aux) };
    });
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-neutral-950 px-3 py-2">
      <input
        className="input h-10 max-w-56"
        placeholder={`Nome (ex.: Retorno Ministro)`}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => ret && save({ label: label.trim() })}
      />
      <button className={`h-10 rounded-xl px-3 text-sm font-semibold ${ret ? "btn-brand" : "btn-ghost"}`} onClick={() => save(ret ? null : {})}>
        {ret ? "✓ Voluntários veem este retorno" : "Mostrar pros voluntários"}
      </button>
    </div>
  );
}

export function ReturnsScreen() {
  const tech = useUi((s) => s.tech);
  const aux = useUi((s) => s.aux);
  const caps = useMixer((s) => s.caps);
  const returns = useConfig((s) => s.config.returns);
  const list = tech ? Array.from({ length: caps.aux }, (_, i) => i + 1) : returns.map((r) => r.aux).filter((a) => a <= caps.aux);
  const selected = aux != null && list.includes(aux) ? aux : null;
  const target = useMemo<StripTarget | null>(() => (selected ? { type: "aux", aux: selected } : null), [selected]);
  const name = useAuxName(selected ?? 1);
  const pick = (a: number | null) => useUi.setState({ aux: a });

  if (!list.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-neutral-400">
        <div className="text-5xl">🎧</div>
        <p className="text-lg">Nenhum retorno liberado ainda.</p>
        <p className="text-sm">O técnico escolhe quais retornos aparecem aqui, no visual técnico.</p>
      </div>
    );
  }

  if (!selected || !target) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="mb-4 text-xl font-semibold">Qual retorno você quer ajustar?</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((a) => (
            <ReturnButton key={a} aux={a} active={false} onClick={() => pick(a)} big />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 px-3 py-2">
        <button className="btn-ghost h-11 shrink-0 px-3" onClick={() => pick(null)} aria-label="Voltar pra lista de retornos">
          ←
        </button>
        {list.map((a) => (
          <ReturnButton key={a} aux={a} active={a === selected} onClick={() => pick(a)} />
        ))}
      </div>
      {tech && <ReturnEditor key={selected} aux={selected} />}
      <StripRack target={target} busLabel={name} />
    </div>
  );
}
