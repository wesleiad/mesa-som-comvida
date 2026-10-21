import { useCallback, useEffect, useState } from "react";
import type { FoundMixer } from "@shared/types";
import { updateConfig, useConfig } from "../state/config";
import { Modal } from "./Dialog";

/** Procura Soundcraft Ui na rede (a busca roda no computador da igreja) e conecta com um toque. */
export function DiscoverDialog({ onClose }: { onClose: () => void }) {
  const current = useConfig((s) => s.config);
  const [found, setFound] = useState<FoundMixer[] | null>(null);
  const [error, setError] = useState("");

  const search = useCallback(async () => {
    setFound(null);
    setError("");
    try {
      const res = await fetch("/api/discover", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFound(await res.json());
    } catch {
      setError("Não consegui falar com o computador da igreja pra fazer a busca.");
      setFound([]);
    }
  }, []);

  useEffect(() => {
    search();
  }, [search]);

  function use(ip: string | null) {
    updateConfig(ip ? { mixerIp: ip, simulator: false } : { simulator: true });
    onClose();
  }

  return (
    <Modal title="🔍 Procurar mesa de som" onClose={onClose}>
      {found === null ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500/30 border-t-brand-500" />
          <p className="text-lg">Procurando a mesa na rede…</p>
          <p className="text-sm text-neutral-500">Leva uns 5 segundos.</p>
        </div>
      ) : found.length > 0 ? (
        <div className="space-y-3">
          <p className="text-neutral-400">{found.length === 1 ? "Encontrei esta mesa:" : `Encontrei ${found.length} mesas:`}</p>
          {found.map((m) => {
            const active = !current.simulator && current.mixerIp === m.ip;
            return (
              <div key={m.ip} className={`flex items-center gap-3 rounded-2xl border p-3 ${active ? "border-brand-500 bg-brand-500/10" : "border-white/10 bg-neutral-950"}`}>
                <div className="text-3xl">🎛️</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">Soundcraft {m.model.replace(/^Soundcraft /, "")}</div>
                  <div className="font-mono text-sm text-neutral-400">{m.ip}</div>
                </div>
                <button className={`h-12 shrink-0 px-4 ${active ? "btn-ghost" : "btn-brand"}`} onClick={() => use(m.ip)}>
                  {active ? "✓ Conectada" : "Usar esta"}
                </button>
              </div>
            );
          })}
          <button className="btn-ghost h-11 w-full text-sm" onClick={search}>
            ↻ Procurar de novo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-lg">{error || "Não achei nenhuma mesa Soundcraft na rede."}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-400">
            <li>Confira se a mesa está ligada (leva uns 40 segundos pra iniciar).</li>
            <li>
              O <b>computador</b> precisa estar no Wi-Fi da mesa (ex.: "Soundcraft Ui24-…") ou no mesmo roteador que ela, por Wi-Fi ou cabo.
            </li>
            <li>Se souber o IP, digite em Ajustes → Conexão com a mesa (visual técnico).</li>
          </ul>
          <div className="flex gap-3">
            <button className="btn-brand h-12 flex-1" onClick={search}>
              ↻ Procurar de novo
            </button>
            <button className="btn-ghost h-12 flex-1" onClick={() => use(null)}>
              Usar simulador
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
