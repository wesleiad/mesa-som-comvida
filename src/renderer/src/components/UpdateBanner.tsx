import { useEffect, useState } from "react";
import type { UpdateStatus } from "@shared/types";

/** A atualização é do programa do computador: tablets e celulares não mostram o aviso. */
const isPc = ["127.0.0.1", "localhost"].includes(location.hostname);

export function useUpdateStatus(): UpdateStatus | null {
  const [st, setSt] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = () =>
      fetch("/api/update", { cache: "no-store" })
        .then((r) => r.json())
        .then((s: UpdateStatus) => alive && setSt(s))
        .catch(() => {});
    poll();
    const id = setInterval(poll, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return st;
}

export function UpdateBanner() {
  const st = useUpdateStatus();
  const [restarting, setRestarting] = useState(false);
  if (!isPc || st?.state !== "ready") return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-200">
      <span>⬇️ Versão nova ({st.next}) baixada. Ela é instalada sozinha quando você fechar o programa.</span>
      <button
        className="rounded-lg bg-emerald-500 px-3 py-1 font-semibold text-black disabled:opacity-50"
        disabled={restarting}
        onClick={() => {
          setRestarting(true);
          fetch("/api/update/install", { method: "POST" }).catch(() => setRestarting(false));
        }}
      >
        {restarting ? "Atualizando…" : "Atualizar agora"}
      </button>
    </div>
  );
}
