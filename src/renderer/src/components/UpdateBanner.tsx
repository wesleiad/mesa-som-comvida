import { useEffect, useState } from "react";
import type { UpdateStatus } from "@shared/types";
import { APP_VERSION, isNativeApp } from "../lib/platform";

/** Janela do programa instalado no computador (não um navegador de tablet/celular). */
export const isPc = /Electron/i.test(navigator.userAgent);

const REPO = "wesleiad/mesa-som-comvida";

function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

/** App Android: pergunta ao GitHub se tem versão nova (só quando houver internet). */
async function checkGithub(): Promise<UpdateStatus> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rel = (await res.json()) as { tag_name: string; assets: { name: string; browser_download_url: string }[] };
  const latest = rel.tag_name.replace(/^v/, "");
  const apk = rel.assets.find((a) => a.name.endsWith(".apk"))?.browser_download_url;
  return apk && isNewer(latest, APP_VERSION) ? { state: "ready", current: APP_VERSION, next: latest, url: apk } : { state: "idle", current: APP_VERSION };
}

export function useUpdateStatus(): UpdateStatus | null {
  const [st, setSt] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = isNativeApp
      ? () =>
          checkGithub()
            .then((s) => alive && setSt(s))
            .catch(() => alive && setSt({ state: "idle", current: APP_VERSION, error: "sem internet" }))
      : () =>
          fetch("/api/update", { cache: "no-store" })
            .then((r) => r.json())
            .then((s: UpdateStatus) => alive && setSt(s))
            .catch(() => {});
    poll();
    const id = setInterval(poll, isNativeApp ? 30 * 60_000 : 20_000);
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
  if (st?.state !== "ready") return null;
  if (isNativeApp && st.url) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-200">
        <span>⬇️ Versão nova do app ({st.next}).</span>
        <a href={st.url} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-500 px-3 py-1 font-semibold text-black">
          Baixar e instalar
        </a>
      </div>
    );
  }
  if (!isPc) return null;
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
