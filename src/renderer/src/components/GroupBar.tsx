import { useEffect, useMemo, useState } from "react";
import type { FlagGroup, StripKey } from "@shared/types";
import { allStripKeys, auxSend, masterChannel, useMixer } from "../lib/mixer";
import { useConfig } from "../state/config";
import { useUi } from "../state/ui";

/** Onde o grupo age: no PA (master), dentro de um retorno, ou nos retornos inteiros. */
export type GroupContext = { type: "master" } | { type: "aux"; aux: number } | { type: "returns" };

interface Mutable {
  mute$: { subscribe(fn: (v: boolean) => void): { unsubscribe(): void } };
  setMute(v: boolean): void;
}

/** Canais (ou retornos) que fazem parte de um grupo, já no contexto certo. */
function useMembers(group: FlagGroup, ctx: GroupContext): Mutable[] {
  const ui = useMixer((s) => s.ui);
  const caps = useMixer((s) => s.caps);
  const strips = useConfig((s) => s.config.strips);
  const auxGroups = useConfig((s) => s.config.auxGroups);
  const auxN = ctx.type === "aux" ? ctx.aux : 0;
  return useMemo(() => {
    if (!ui) return [];
    if (group.kind === "returns") {
      return Object.entries(auxGroups)
        .filter(([n, ids]) => ids.includes(group.id) && Number(n) <= caps.aux)
        .map(([n]) => ui.master.aux(Number(n)) as Mutable);
    }
    const keys = allStripKeys(caps)
      .flatMap((g) => g.keys)
      .filter((k: StripKey) => strips[k]?.groups?.includes(group.id));
    return keys.map((k) => (auxN ? auxSend(ui, auxN, k) : masterChannel(ui, k)) as Mutable);
  }, [ui, caps, strips, auxGroups, group, auxN]);
}

function useAllMuted(members: Mutable[]): { muted: number; total: number } {
  const [states, setStates] = useState<boolean[]>([]);
  useEffect(() => {
    setStates(members.map(() => false));
    const subs = members.map((m, i) =>
      m.mute$.subscribe((v) =>
        setStates((prev) => {
          if (prev[i] === v) return prev;
          const next = [...prev];
          next[i] = v;
          return next;
        }),
      ),
    );
    return () => subs.forEach((s) => s.unsubscribe());
  }, [members]);
  return { muted: states.filter(Boolean).length, total: members.length };
}

function GroupChip({ group, ctx }: { group: FlagGroup; ctx: GroupContext }) {
  const members = useMembers(group, ctx);
  const { muted, total } = useAllMuted(members);
  const tech = useUi((s) => s.tech);
  const all = total > 0 && muted === total;
  if (!total && !tech) return null;

  function toggle() {
    // Se está tudo mutado, desmuta; senão muta todo mundo (inclusive quem estava ligado).
    members.forEach((m) => m.setMute(!all));
  }

  return (
    <button
      onClick={toggle}
      disabled={!total}
      title={total ? `${group.name}: ${total} ${group.kind === "returns" ? "retorno(s)" : "canal(is)"}` : "Nenhum item marcado com este grupo"}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition active:scale-95 disabled:opacity-35 ${
        all ? "bg-red-600 text-white" : "bg-[#242424] text-neutral-200 ring-1 ring-white/10"
      }`}
      style={all ? undefined : { boxShadow: `inset 3px 0 0 ${group.color}` }}
      aria-pressed={all}
    >
      <span>{group.icon}</span>
      <span className="whitespace-nowrap">{group.name}</span>
      <span className={`rounded px-1 text-[10px] font-bold ${all ? "bg-black/30" : muted ? "bg-amber-500/25 text-amber-300" : "bg-white/10 text-neutral-400"}`}>
        {all ? "MUTADO" : muted ? `${muted}/${total}` : total}
      </span>
    </button>
  );
}

/** Fileira de botões de grupo (flags), estilo grupos de mute do Mixing Station. */
export function GroupBar({ ctx }: { ctx: GroupContext }) {
  const groups = useConfig((s) => s.config.groups);
  const kind = ctx.type === "returns" ? "returns" : "channels";
  const list = groups.filter((g) => g.kind === kind);
  if (!list.length) return null;
  const where = ctx.type === "aux" ? "neste retorno" : ctx.type === "returns" ? "retornos" : "no PA";
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/10 bg-[#141414] px-2 py-1.5">
      <span className="shrink-0 pr-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Mutar {where}</span>
      {list.map((g) => (
        <GroupChip key={g.id} group={g} ctx={ctx} />
      ))}
    </div>
  );
}
